//! Lagu yang sedang diputar dari kontrol media Windows (Spotify, browser/YouTube, dsb.).

use crate::lyrics::Emit;
use std::sync::mpsc::Receiver;
use std::sync::{Arc, Mutex};

#[derive(Default, Clone)]
pub struct Last {
    pub key: String,
    pub album: String,
    pub dur: f64,
}

#[cfg(not(windows))]
pub fn run(emit: Emit, _rx: Receiver<String>, _last: Arc<Mutex<Last>>) {
    emit("media", serde_json::json!({"available": false}).to_string());
}

#[cfg(windows)]
pub fn run(emit: Emit, rx: Receiver<String>, last: Arc<Mutex<Last>>) {
    imp::run(emit, rx, last)
}

#[cfg(windows)]
mod imp {
    use super::*;
    use crate::lyrics;
    use crate::store::{asset_url, log, now_s, p, sha1_hex};
    use crate::sys;
    use serde_json::{json, Value};
    use std::time::Duration;
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSession as Session, GlobalSystemMediaTransportControlsSessionManager as Manager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
    };
    use windows::Storage::Streams::{DataReader, IRandomAccessStreamReference};

    const SERVICES: &[(&str, &str)] = &[("youtube music", "YouTube Music"), ("youtube", "YouTube"), ("spotify", "Spotify"), ("soundcloud", "SoundCloud"),
        ("apple music", "Apple Music"), ("joox", "JOOX"), ("deezer", "Deezer"), ("resso", "Resso"), ("tidal", "TIDAL")];

    /// Tebak layanan musik (YouTube, Spotify, ...) dari judul jendela browser.
    fn media_source(app: &str, title: &str) -> String {
        if app.to_lowercase().contains("spotify") {
            return "Spotify".into();
        }
        if title.is_empty() {
            return app.into();
        }
        let key: String = title.to_lowercase().chars().take(40).collect();
        for t in sys::window_titles_containing(&key) {
            for (k, name) in SERVICES {
                if t.contains(k) {
                    return name.to_string();
                }
            }
        }
        app.into()
    }

    fn thumb(r: &IRandomAccessStreamReference) -> Option<Vec<u8>> {
        let stream = r.OpenReadAsync().ok()?.get().ok()?;
        let size = stream.Size().ok()?;
        if size == 0 || size > 10_000_000 {
            return None;
        }
        let input = stream.GetInputStreamAt(0).ok()?;
        let reader = DataReader::CreateDataReader(&input).ok()?;
        let n = reader.LoadAsync(size as u32).ok()?.get().ok()?;
        let mut buf = vec![0u8; n as usize];
        reader.ReadBytes(&mut buf).ok()?;
        Some(buf)
    }

    struct St {
        last_payload: Option<Value>,
        last_sent: f64,
        art_url: String,
        was_playing: Option<bool>,
        play_since: f64,
        tl_key: Option<(i64, i64)>,
        tl_seen: f64,
        source: String,
        src_key: String,
        src_at: f64,
        /// aplikasi pemutar yang terakhir dipakai (supaya tidak lompat-lompat antar tab/aplikasi)
        pref_app: String,
        /// sejak kapan tidak ada lagu / gagal membaca (0 = sedang ada lagu)
        empty_since: f64,
        had_song: bool,
    }

    fn is_playing(s: &Session) -> bool {
        s.GetPlaybackInfo().and_then(|p| p.PlaybackStatus()).map(|x| x == Status::Playing).unwrap_or(false)
    }

    fn aumid(s: &Session) -> String {
        s.SourceAppUserModelId().map(|h| h.to_string()).unwrap_or_default()
    }

    /// Pilih pemutar: yang sedang memutar lagu lebih diutamakan, lalu pemutar yang terakhir dipakai.
    fn pick_session(m: &Manager, pref: &str) -> Option<Session> {
        let cur = m.GetCurrentSession().ok();
        if let Some(c) = &cur {
            if is_playing(c) {
                return cur;
            }
        }
        let mut all = vec![];
        if let Ok(v) = m.GetSessions() {
            for i in 0..v.Size().unwrap_or(0) {
                if let Ok(x) = v.GetAt(i) {
                    all.push(x);
                }
            }
        }
        let playing: Vec<&Session> = all.iter().filter(|x| is_playing(x)).collect();
        if let Some(x) = playing.iter().find(|x| aumid(x) == pref).or_else(|| playing.first()) {
            return Some((*x).clone());
        }
        if let Some(x) = all.iter().find(|x| !pref.is_empty() && aumid(x) == pref) {
            return Some(x.clone());
        }
        cur
    }

    fn command(s: &Session, c: &str) {
        let r = match c {
            "toggle" => s.TryTogglePlayPauseAsync().and_then(|o| o.get()),
            "next" => s.TrySkipNextAsync().and_then(|o| o.get()),
            "prev" => s.TrySkipPreviousAsync().and_then(|o| o.get()),
            _ => match c.strip_prefix("seek:").and_then(|x| x.parse::<f64>().ok()) {
                Some(sec) => s.TryChangePlaybackPositionAsync((sec * 10_000_000.0) as i64).and_then(|o| o.get()),
                None => Ok(false),
            },
        };
        if let Err(e) = r {
            log(format!("media cmd {} {}", c, e));
        }
    }

    fn app_name(aumid: &str) -> String {
        let a = aumid.rsplit('!').next().unwrap_or("");
        let a = a.rsplit('\\').next().unwrap_or("");
        let a = a.strip_suffix(".exe").or_else(|| a.strip_suffix(".EXE")).unwrap_or(a);
        match a.to_lowercase().as_str() {
            "chrome" => "Chrome".into(),
            "msedge" => "Edge".into(),
            "firefox" => "Firefox".into(),
            "spotify" => "Spotify".into(),
            _ => a.chars().take(20).collect(),
        }
    }

    pub fn run(emit: Emit, rx: Receiver<String>, last: Arc<Mutex<Last>>) {
        unsafe {
            let _ = windows::Win32::System::Com::CoInitializeEx(None, windows::Win32::System::Com::COINIT_MULTITHREADED);
        }
        let mut mgr: Option<Manager> = None;
        let mut st = St { last_payload: None, last_sent: 0.0, art_url: String::new(), was_playing: None, play_since: 0.0, tl_key: None, tl_seen: 0.0,
            source: String::new(), src_key: String::new(), src_at: 0.0, pref_app: String::new(), empty_since: 0.0, had_song: false };
        let mut chosen: Option<Session> = None;
        loop {
            let res: windows::core::Result<()> = (|| {
                if mgr.is_none() {
                    mgr = Some(Manager::RequestAsync()?.get()?);
                }
                let m = mgr.as_ref().unwrap();
                let sess = pick_session(m, &st.pref_app);
                if let Some(s) = &sess {
                    st.pref_app = aumid(s);
                }
                chosen = sess.clone();
                while let Ok(c) = rx.try_recv() {
                    if let Some(s) = &sess {
                        command(s, &c);
                    }
                }
                let mut info = json!({"available": true, "has": false});
                if let Some(s) = &sess {
                    let props = s.TryGetMediaPropertiesAsync()?.get()?;
                    let pb = s.GetPlaybackInfo()?;
                    let playing = pb.PlaybackStatus()? == Status::Playing;
                    let title = props.Title().map(|h| h.to_string()).unwrap_or_default();
                    let artist = props.Artist().map(|h| h.to_string()).unwrap_or_default();
                    let album = props.AlbumTitle().map(|h| h.to_string()).unwrap_or_default();
                    let now = now_s();
                    if playing && st.was_playing == Some(false) {
                        st.play_since = now; // baru dilanjutkan setelah jeda
                    }
                    st.was_playing = Some(playing);
                    let (mut pos, mut dur, mut can_seek) = (0.0f64, 0.0f64, false);
                    if let Ok(tl) = s.GetTimelineProperties() {
                        let raw = tl.Position().map(|t| t.Duration as f64 / 1e7).unwrap_or(0.0);
                        let a = tl.StartTime().map(|t| t.Duration).unwrap_or(0);
                        let b = tl.EndTime().map(|t| t.Duration).unwrap_or(0);
                        dur = ((b - a) as f64 / 1e7).max(0.0);
                        // DateTime: 100 ns sejak 1601
                        let lu = tl.LastUpdatedTime().map(|d| (d.UniversalTime - 116_444_736_000_000_000) as f64 / 1e7).unwrap_or(0.0);
                        let key = ((raw * 100.0).round() as i64, (lu * 100.0).round() as i64);
                        if st.tl_key != Some(key) {
                            st.tl_key = Some(key);
                            st.tl_seen = now;
                        }
                        pos = raw;
                        if playing {
                            let mut r = if lu > 0.0 && lu <= now + 1.0 && now - lu < 6.0 * 3600.0 { lu } else { st.tl_seen };
                            if st.play_since > st.tl_seen {
                                r = r.max(st.play_since);
                            }
                            pos += (now - r).max(0.0);
                        }
                        if dur > 0.0 {
                            pos = pos.min(dur);
                        }
                        can_seek = pb.Controls().and_then(|c| c.IsPlaybackPositionEnabled()).unwrap_or(false);
                    }
                    let aumid = s.SourceAppUserModelId().map(|h| h.to_string()).unwrap_or_default();
                    let key = format!("{}|{}", title, artist);
                    let ad = lyrics::is_ad(&aumid, &title, &artist);
                    let changed = { last.lock().unwrap().key != key };
                    if !title.is_empty() && changed && !ad {
                        *last.lock().unwrap() = Last { key: key.clone(), album: album.clone(), dur };
                        st.art_url.clear();
                        if let Ok(r) = props.Thumbnail() {
                            if let Some(data) = thumb(&r) {
                                let h = &sha1_hex(&data)[..16];
                                let path = p(&["art", &format!("{}.img", h)]);
                                if !path.exists() {
                                    let _ = std::fs::write(&path, &data);
                                }
                                st.art_url = asset_url(&path);
                            }
                        }
                        let (e, t, a, al) = (emit.clone(), title.clone(), artist.clone(), album.clone());
                        std::thread::spawn(move || lyrics::fetch(&e, &t, &a, &al, dur, false));
                    }
                    let app = app_name(&aumid);
                    if key != st.src_key || now - st.src_at > 20.0 {
                        st.src_key = key.clone();
                        st.src_at = now;
                        st.source = media_source(&app, &title);
                    }
                    info = json!({"available": true, "has": !title.is_empty(), "title": title, "artist": artist, "album": album,
                        "source": if st.source.is_empty() { app.clone() } else { st.source.clone() }, "ad": ad, "playing": playing,
                        "pos": pos, "dur": dur, "ts": crate::store::now_ms(), "app": app, "art": st.art_url, "canSeek": can_seek});
                }
                let mut payload = info.clone();
                if let Some(o) = payload.as_object_mut() {
                    o.remove("pos");
                    o.remove("ts");
                    o.insert("_tl".into(), json!(st.tl_key.map(|k| vec![k.0, k.1])));
                }
                let now = now_s();
                // "tidak ada lagu" sesaat (Windows kadang gagal membaca) jangan langsung dikirim:
                // tunggu 2,5 detik supaya lirik tidak terhapus di tengah lagu
                let has = info["has"].as_bool().unwrap_or(false);
                if has {
                    st.empty_since = 0.0;
                    st.had_song = true;
                } else if st.had_song {
                    if st.empty_since == 0.0 {
                        st.empty_since = now;
                    }
                    if now - st.empty_since < 2.5 {
                        return Ok(());
                    }
                    st.had_song = false;
                }
                if st.last_payload.as_ref() != Some(&payload) || now - st.last_sent > 2.5 {
                    st.last_payload = Some(payload);
                    st.last_sent = now;
                    emit("media", info.to_string());
                }
                Ok(())
            })();
            if let Err(e) = res {
                log(format!("media {}", e));
                mgr = None;
                // gagal sesaat: lagu dianggap masih diputar; baru dilaporkan berhenti kalau gagal terus > 3 d
                let now = now_s();
                if st.empty_since == 0.0 {
                    st.empty_since = now;
                }
                if now - st.empty_since > 3.0 && st.had_song {
                    st.had_song = false;
                    st.last_payload = None;
                    emit("media", json!({"available": true, "has": false}).to_string());
                }
                std::thread::sleep(Duration::from_millis(700));
            }
            // tunggu 0,5 d, tapi langsung bangun kalau ada perintah
            if let Ok(c) = rx.recv_timeout(Duration::from_millis(500)) {
                if let Some(s) = &chosen {
                    command(s, &c);
                }
            }
        }
    }
}
