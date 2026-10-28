//! Lirik dari LRCLIB (cadangan: lyrics.ovh), dengan pencocokan judul YouTube/Spotify.

use crate::store::{http_json, log, now_s, p, read_json, sha1_hex, write_json};
use regex::Regex;
use serde_json::{json, Value};
use std::sync::OnceLock;

pub type Emit = std::sync::Arc<dyn Fn(&str, String) + Send + Sync>;

fn re(s: &str) -> Regex {
    Regex::new(s).unwrap()
}

fn norm(s: &str) -> String {
    static R1: OnceLock<Regex> = OnceLock::new();
    static R2: OnceLock<Regex> = OnceLock::new();
    let s = s.to_lowercase();
    let s = R1.get_or_init(|| re(r"[^\w\s]")).replace_all(&s, " ");
    R2.get_or_init(|| re(r"\s+")).replace_all(&s, " ").trim().to_string()
}

/// Rasio kemiripan seperti difflib.SequenceMatcher.ratio()
fn ratio(a: &[char], b: &[char]) -> f64 {
    fn matches(a: &[char], b: &[char]) -> usize {
        if a.is_empty() || b.is_empty() {
            return 0;
        }
        // blok sama terpanjang
        let (mut best, mut bi, mut bj) = (0usize, 0usize, 0usize);
        let mut prev = vec![0usize; b.len() + 1];
        for i in 0..a.len() {
            let mut cur = vec![0usize; b.len() + 1];
            for j in 0..b.len() {
                if a[i] == b[j] {
                    cur[j + 1] = prev[j] + 1;
                    if cur[j + 1] > best {
                        best = cur[j + 1];
                        bi = i + 1 - best;
                        bj = j + 1 - best;
                    }
                }
            }
            prev = cur;
        }
        if best == 0 {
            return 0;
        }
        best + matches(&a[..bi], &b[..bj]) + matches(&a[bi + best..], &b[bj + best..])
    }
    let t = a.len() + b.len();
    if t == 0 {
        return 1.0;
    }
    2.0 * matches(a, b) as f64 / t as f64
}

pub fn sim(a: &str, b: &str) -> f64 {
    let (a, b) = (norm(a), norm(b));
    if a.is_empty() || b.is_empty() {
        return 0.0;
    }
    let r = ratio(&a.chars().collect::<Vec<_>>(), &b.chars().collect::<Vec<_>>());
    if a.contains(&b) || b.contains(&a) {
        return r.max(0.8);
    }
    r
}

const NOISE: &str = r"official|music video|video|lyrics?|lirik|audio|m/?v|hd|hq|4k|visuali[sz]er|remaster(ed)?|video klip|klip|full album|karaoke|live session|dolby|360|color coded|eng sub|sub indo";

fn strip_set(s: &str, chars: &str) -> String {
    s.trim_matches(|c| chars.contains(c)).to_string()
}

/// Bersihkan judul YouTube dsb. Mengembalikan beberapa kemungkinan (judul, artis).
pub fn clean_track(title: &str, artist: &str) -> Vec<(String, String)> {
    let mut a = re(r"(?i)\s*-\s*Topic$").replace(artist, "").to_string();
    a = strip_set(&re(r"(?i)\s*(VEVO|Official|Music|Records|Channel|TV)$").replace(&a, ""), " -");
    let a = a.trim().to_string();
    let mut t = title.to_string();
    let open = r"\(\[【「（〔";
    let close = r"\)\]】」）〕";
    t = re(&format!(r"(?i)[{o}][^{c}]*({n})[^{c}]*[{c}]", o = open, c = close, n = NOISE)).replace_all(&t, "").to_string();
    t = re(r"\s*[|｜].*$").replace(&t, "").to_string();
    t = re(r"#\S+").replace_all(&t, "").to_string();
    t = re(r"(?i)\s+[-–]\s+(official|lyrics?|lirik|audio|video|mv)\b.*$").replace(&t, "").to_string();
    t = re(r"(?i)\s*[\(\[]?\s*\b(ft|feat|featuring)\b\.?\s+[^\)\]\-–]*[\)\]]?").replace_all(&t, "").to_string();
    t = re(r"(?i)\s+(official\s+)?(music\s+)?(video|mv|audio|lyric video|visuali[sz]er)\s*$").replace(&t, "").to_string();
    t = strip_set(&re(r"\s{2,}").replace_all(&t, " "), " -–\"'");
    let mut out: Vec<(String, String)> = vec![];
    if let Some(m) = re(r"[「『]([^」』]+)[」』]").captures(&t) {
        let before = strip_set(&t[..m.get(0).unwrap().start()], " -–");
        out.push((m[1].trim().to_string(), if before.is_empty() { a.clone() } else { before }));
    }
    let parts: Vec<&str> = re(r"\s+[-–]\s+").splitn(&t, 2).collect();
    if parts.len() == 2 {
        let (left, right) = (parts[0].trim().to_string(), parts[1].trim().to_string());
        if a.is_empty() || sim(&a, &left) > 0.5 || a.split_whitespace().count() > 4 {
            out.push((right.clone(), left.clone()));
        }
        out.push((right.clone(), if a.is_empty() { left.clone() } else { a.clone() }));
        out.push((left, right));
    }
    out.push((t.clone(), a.clone()));
    let mut seen = std::collections::HashSet::new();
    out.into_iter().filter(|x| !x.0.is_empty() && seen.insert((norm(&x.0), norm(&x.1)))).collect()
}

fn lyr_cache(key: &str) -> std::path::PathBuf {
    p(&["lyrics", &format!("{}.json", &sha1_hex(key.as_bytes())[..20])])
}

/// LRCLIB sering sibuk (galat 503/429): coba ulang sampai 3 kali dengan jeda
fn lrc_json(url: &str) -> Result<Value, String> {
    let mut last = String::new();
    for i in 0..3 {
        match http_json(url, 10) {
            Ok(v) => return Ok(v),
            Err(e) if e == "HTTP 404" => return Err(e),
            Err(e) => {
                let busy = e.starts_with("HTTP 5") || e == "HTTP 429" || !e.starts_with("HTTP");
                last = e;
                if !busy {
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(700 * (i + 1)));
            }
        }
    }
    Err(last)
}

/// None = server gagal dihubungi
fn lrclib_search(params: &[(&str, String)]) -> Option<Vec<Value>> {
    let q: Vec<String> = params.iter().map(|(k, v)| format!("{}={}", k, urlencoding::encode(v))).collect();
    match lrc_json(&format!("https://lrclib.net/api/search?{}", q.join("&"))) {
        Ok(Value::Array(a)) => Some(a),
        Ok(_) => Some(vec![]),
        Err(e) => {
            log(format!("lrclib search {}", e));
            None
        }
    }
}

fn s(v: &Value, k: &str) -> String {
    v.get(k).and_then(|x| x.as_str()).unwrap_or("").to_string()
}
fn has(v: &Value, k: &str) -> bool {
    v.get(k).and_then(|x| x.as_str()).map(|x| !x.is_empty()).unwrap_or(false)
}
fn dur_of(v: &Value) -> f64 {
    v.get("duration").and_then(|x| x.as_f64()).unwrap_or(0.0)
}

fn best_match(results: &[Value], title: &str, artist: &str, dur: f64) -> Option<Value> {
    let mut best: Option<&Value> = None;
    let mut best_s = -99.0;
    for r in results {
        if r.get("instrumental").and_then(|x| x.as_bool()).unwrap_or(false) && !has(r, "plainLyrics") {
            continue;
        }
        let name = if has(r, "trackName") { s(r, "trackName") } else { s(r, "name") };
        let st = sim(title, &name);
        if st < 0.55 {
            continue;
        }
        let sa = if artist.is_empty() { 1.0 } else { sim(artist, &s(r, "artistName")) };
        let rd0 = dur_of(r);
        let same_len = dur > 0.0 && rd0 > 0.0 && (rd0 - dur).abs() <= 3.0;
        // artis jelas berbeda: hanya diterima kalau judul hampir sama persis DAN durasinya sama
        if !artist.is_empty() && sa < 0.45 && !(st >= 0.9 && same_len) {
            continue;
        }
        let mut sc = 2.5 * st + if artist.is_empty() { 0.0 } else { 1.2 * sa };
        sc += if has(r, "syncedLyrics") { 2.0 } else if has(r, "plainLyrics") { 0.5 } else { -5.0 };
        let rd = dur_of(r);
        if dur > 0.0 && rd > 0.0 {
            let d = (rd - dur).abs();
            sc += if d <= 2.5 { 2.2 } else if d <= 6.0 { 1.2 } else if d <= 12.0 { 0.3 } else { -(d / 15.0).min(3.0) };
        }
        if sc > best_s {
            best = Some(r);
            best_s = sc;
        }
    }
    best.cloned()
}

fn push(results: &mut Vec<Value>, err: &mut bool, r: Option<Vec<Value>>) {
    match r {
        Some(v) => results.extend(v),
        None => *err = true,
    }
}

pub fn fetch(emit: &Emit, title: &str, artist: &str, album: &str, dur: f64, force: bool) {
    let key = format!("{}|{}", title, artist);
    let cache = lyr_cache(&key);
    let mut c = read_json(&cache, Value::Null);
    if !c.is_null() && !force {
        let manual = c.get("manual").and_then(|x| x.as_bool()).unwrap_or(false);
        let v2 = c.get("v").and_then(|x| x.as_i64()) == Some(3);
        let ok = s(&c, "status") == "ok";
        let fresh = now_s() - c.get("t").and_then(|x| x.as_f64()).unwrap_or(0.0) < 2.0 * 86400.0;
        if manual || (v2 && (ok || fresh)) {
            c["key"] = json!(key);
            emit("lyrics", c.to_string());
            return;
        }
    }
    emit("lyrics", json!({"key": key, "status": "loading"}).to_string());
    let cands = clean_track(title, artist);
    let mut found: Option<Value> = None;
    let mut err = false;
    let mut results: Vec<Value> = vec![];
    let close = |r: &Value| dur <= 0.0 || dur_of(r) <= 0.0 || (dur_of(r) - dur).abs() <= 6.0;
    let (t0, a0) = cands.first().cloned().unwrap_or_default();
    if dur > 0.0 && !a0.is_empty() {
        let mut q = format!("track_name={}&artist_name={}&duration={}", urlencoding::encode(&t0), urlencoding::encode(&a0), dur.round() as i64);
        if !album.is_empty() {
            q += &format!("&album_name={}", urlencoding::encode(album));
        }
        match lrc_json(&format!("https://lrclib.net/api/get?{}", q)) {
            Ok(r) if has(&r, "syncedLyrics") || has(&r, "plainLyrics") => found = Some(r),
            Ok(_) => {}
            Err(e) if e == "HTTP 404" => {}
            Err(e) => {
                log(format!("lyrics {}", e));
                err = true;
            }
        }
    }
    if !found.as_ref().map(|f| has(f, "syncedLyrics")).unwrap_or(false) {
        let mut best_all: Option<Value> = None;
        for (t, a) in cands.iter().take(3) {
            if !a.is_empty() {
                push(&mut results, &mut err, lrclib_search(&[("track_name", t.clone()), ("artist_name", a.clone())]));
                push(&mut results, &mut err, lrclib_search(&[("q", format!("{} {}", a, t))]));
            }
            push(&mut results, &mut err, lrclib_search(&[("q", t.clone())]));
            if let Some(m) = best_match(&results, t, a, dur) {
                if has(&m, "syncedLyrics") && close(&m) {
                    found = Some(m);
                    break;
                }
                let better = match &best_all {
                    None => true,
                    Some(b) => has(&m, "syncedLyrics") && !has(b, "syncedLyrics"),
                };
                if better {
                    best_all = Some(m);
                }
            }
        }
        if !found.as_ref().map(|f| has(f, "syncedLyrics")).unwrap_or(false) {
            if let Some(b) = best_all {
                found = Some(b);
            }
        }
    }
    if found.is_none() {
        for (t, a) in cands.iter().take(2) {
            if a.is_empty() {
                continue;
            }
            if let Ok(r) = http_json(&format!("https://api.lyrics.ovh/v1/{}/{}", urlencoding::encode(a), urlencoding::encode(t)), 8) {
                if has(&r, "lyrics") {
                    found = Some(json!({"plainLyrics": s(&r, "lyrics").trim(), "source": "lyrics.ovh"}));
                    break;
                }
            }
        }
    }
    let mut out = match &found {
        Some(f) if has(f, "syncedLyrics") || has(f, "plainLyrics") => {
            let artist_n = s(f, "artistName");
            json!({"status": "ok", "synced": s(f, "syncedLyrics"), "plain": s(f, "plainLyrics"),
                   "instrumental": f.get("instrumental").and_then(|x| x.as_bool()).unwrap_or(false),
                   "source": if has(f, "source") { s(f, "source") } else { "LRCLIB".into() },
                   "ldur": dur_of(f),
                   "match": s(f, "trackName") + &(if artist_n.is_empty() { String::new() } else { format!(" — {}", artist_n) })})
        }
        _ if err => json!({"status": "error"}),
        _ => json!({"status": "none", "query": if a0.is_empty() { t0.clone() } else { format!("{} - {}", a0, t0) }}),
    };
    out["t"] = json!(now_s());
    out["v"] = json!(3);
    if s(&out, "status") != "error" {
        write_json(&cache, &out);
    }
    out["key"] = json!(key);
    emit("lyrics", out.to_string());
}

pub fn search(emit: &Emit, key: &str, query: &str) {
    let res = lrclib_search(&[("q", query.to_string())]).unwrap_or_default();
    let out: Vec<Value> = res
        .iter()
        .filter(|r| has(r, "syncedLyrics") || has(r, "plainLyrics"))
        .take(15)
        .map(|r| json!({"id": r.get("id"), "track": s(r, "trackName"), "artist": s(r, "artistName"), "album": s(r, "albumName"),
                        "dur": r.get("duration"), "synced": has(r, "syncedLyrics")}))
        .collect();
    emit("lyricsResults", json!({"key": key, "results": out}).to_string());
}

pub fn pick(emit: &Emit, key: &str, id: i64) {
    let mut out = match http_json(&format!("https://lrclib.net/api/get/{}", id), 10) {
        Ok(r) => {
            let artist_n = s(&r, "artistName");
            let o = json!({"status": "ok", "synced": s(&r, "syncedLyrics"), "plain": s(&r, "plainLyrics"), "source": "LRCLIB",
                "instrumental": r.get("instrumental").and_then(|x| x.as_bool()).unwrap_or(false), "manual": true, "ldur": dur_of(&r), "v": 3,
                "match": s(&r, "trackName") + &(if artist_n.is_empty() { String::new() } else { format!(" — {}", artist_n) }), "t": now_s()});
            write_json(&lyr_cache(key), &o);
            o
        }
        Err(e) => {
            log(format!("lyrics pick {}", e));
            json!({"status": "error"})
        }
    };
    out["key"] = json!(key);
    emit("lyrics", out.to_string());
}

#[allow(dead_code)]
pub fn is_ad(app: &str, title: &str, artist: &str) -> bool {
    let tl = title.trim().to_lowercase();
    if ["advertisement", "advertisment", "iklan", "spotify", "ad", "sponsored", "spotify free"].contains(&tl.as_str()) {
        return true;
    }
    app.to_lowercase().contains("spotify") && artist.trim().is_empty()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bersihkan_judul() {
        let c = clean_track("Sal Priadi - Amin Paling Serius (Official Music Video)", "Sal Priadi");
        assert_eq!(c[0], ("Amin Paling Serius".to_string(), "Sal Priadi".to_string()));
        let c = clean_track("Hindia - Evaluasi | Lirik", "Hindia - Topic");
        assert!(c.iter().any(|x| x.0 == "Evaluasi" && x.1 == "Hindia"));
        assert!(sim("Amin Paling Serius", "amin paling serius") > 0.99);
        assert!((ratio(&"abcd".chars().collect::<Vec<_>>(), &"bcde".chars().collect::<Vec<_>>()) - 0.75).abs() < 1e-9);
        assert!(is_ad("Spotify.exe", "Spotify", ""));
    }
    #[test]
    fn tolak_artis_beda() {
        let r = vec![json!({"trackName": "Claude", "artistName": "An Unknown Artist", "duration": 375.0, "syncedLyrics": "[00:01.00] x"})];
        assert!(best_match(&r, "Claude", "Fireship", 612.0).is_none(), "video Claude tidak boleh diberi lirik lagu lain");
        let r = vec![json!({"trackName": "Jiwa Yang Bersedih", "artistName": "Ghea Indrawari", "duration": 245.0, "syncedLyrics": "[00:01.00] x"})];
        assert!(best_match(&r, "Jiwa Yang Bersedih", "Ghea Indrawari", 246.0).is_some());
        // nama kanal YouTube beda dengan artis, tapi judul & durasi sama -> tetap diterima
        assert!(best_match(&r, "Jiwa Yang Bersedih", "Sony Music Indonesia", 245.5).is_some());
    }
}

