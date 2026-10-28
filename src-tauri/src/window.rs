//! Jendela notch: posisi menempel (atas/bawah/kiri/kanan) atau melayang, seret, klik-tembus, kursor untuk mata Notnot.
//!
//! Saat diseret jendelanya seukuran kanvas CSS 1440x960 (dikali zoom); saat diam dipotong agar muat di layar. Antarmuka melaporkan kotak notch (setRect);
//! di luar kotak itu jendela dibuat tembus klik, jadi aplikasi di belakangnya tetap bisa dipakai.

use crate::store::{jbool, jf64, jstr, log, now_s, p, write_json};
use crate::Core;
use serde_json::{json, Value};
use tauri::{Emitter, PhysicalPosition, PhysicalSize};

pub const CSS_W: f64 = 1440.0;
pub const CSS_H: f64 = 960.0;

#[derive(Clone, Debug)]
pub struct Mon {
    pub name: String,
    pub full: (f64, f64, f64, f64),
    pub work: (f64, f64, f64, f64),
    pub sf: f64,
}

pub struct Drag {
    off: (f64, f64),
    dock: Option<String>,
    sname: String,
    along: Option<f64>,
    center: (f64, f64),
    mon: Option<Mon>,
    last: Option<String>,
}

pub struct WinState {
    pub st: Value,
    pub zoom: f64,
    pub sf: f64,
    pub pos: (f64, f64),
    pub size: (u32, u32),
    pub drag: Option<Drag>,
    pub rect: Option<[f64; 4]>,
    pub fs_hidden: bool,
    pub force_until: f64,
    pub last_cursor: Option<(i64, i64)>,
    pub ignoring: Option<bool>,
    pub layout: Value,
    pub mon_sig: String,
    pub visible: bool,
}

impl WinState {
    pub fn new(zoom: f64) -> Self {
        let mut st = crate::store::read_json(&p(&["state.json"]), json!({}));
        if !st.is_object() {
            st = json!({});
        }
        for (k, v) in [("dock", json!("top")), ("along", json!(0.5)), ("fx", json!(0.5)), ("fy", json!(0.2))] {
            if st.get(k).is_none() {
                st[k] = v;
            }
        }
        WinState { st, zoom, sf: 0.0, pos: (0.0, 0.0), size: (0, 0), drag: None, rect: None, fs_hidden: false, force_until: 0.0, last_cursor: None,
            ignoring: None, layout: json!({}), mon_sig: String::new(), visible: false }
    }
}

pub fn zoom_of(cfg: &Value) -> f64 {
    (jf64(cfg, &["theme", "scale"], 100.0) / 100.0).clamp(0.75, 1.5)
}

pub fn monitors(core: &Core) -> Vec<Mon> {
    let Some(w) = core.window() else { return vec![] };
    w.available_monitors()
        .unwrap_or_default()
        .iter()
        .map(|m| {
            let (pos, size, wa) = (m.position(), m.size(), m.work_area());
            Mon {
                name: m.name().cloned().unwrap_or_default(),
                full: (pos.x as f64, pos.y as f64, size.width as f64, size.height as f64),
                work: (wa.position.x as f64, wa.position.y as f64, wa.size.width as f64, wa.size.height as f64),
                sf: m.scale_factor(),
            }
        })
        .collect()
}

fn primary(core: &Core) -> Option<Mon> {
    let w = core.window()?;
    let pm = w.primary_monitor().ok()??;
    let n = pm.name().cloned().unwrap_or_default();
    monitors(core).into_iter().find(|m| m.name == n)
}

pub fn screen_in(all: &[Mon], prim: Option<Mon>, ws: &WinState) -> Option<Mon> {
    let name = jstr(&ws.st, &["screen"]);
    all.iter().find(|m| !name.is_empty() && m.name == name).cloned().or(prim).or_else(|| all.first().cloned())
}

/// Posisi & ukuran jendela (piksel fisik) + info tata letak untuk antarmuka (piksel CSS).
///
/// `fit = true` (saat diam): jendela dipotong supaya muat di area layar dan titik jangkar notch dihitung ulang.
/// Jendela yang lebih besar dari layar dipotong Windows sendiri, sehingga notch di kanan/bawah bisa hilang.
/// `fit = false` (saat diseret): jendela tetap seukuran kanvas penuh dan ikut kursor.
pub fn layout_for(ws: &WinState, dock: &str, m: &Mon, along: Option<f64>, center: Option<(f64, f64)>, fit: bool) -> ((f64, f64), (u32, u32), Value) {
    let (gx, gy, gw, gh) = m.work;
    let z = ws.zoom * m.sf;
    let (w, h) = (CSS_W * z, CSS_H * z);
    let mut grow = "down";
    let along_v = along.unwrap_or_else(|| jf64(&ws.st, &["along"], 0.5));
    // titik jangkar notch di layar + posisi jendela kanvas penuh
    let (anchor, mut x, mut y);
    match dock {
        "top" | "bottom" => {
            let cx = gx + along_v * gw;
            anchor = (cx, if dock == "top" { gy } else { gy + gh });
            x = cx - w / 2.0;
            y = if dock == "top" { gy } else { gy + gh - h };
        }
        "left" | "right" => {
            let cy = gy + along_v * gh;
            anchor = (if dock == "left" { gx } else { gx + gw }, cy);
            y = cy - h / 2.0;
            x = if dock == "left" { gx } else { gx + gw - w };
        }
        _ => {
            let c = center.unwrap_or((gx + jf64(&ws.st, &["fx"], 0.5) * gw, gy + jf64(&ws.st, &["fy"], 0.2) * gh));
            anchor = c;
            x = c.0 - w / 2.0;
            y = c.1 - h / 2.0;
            grow = if c.1 < gy + gh / 2.0 { "down" } else { "up" };
        }
    }
    let (mut ww, mut wh) = (w, h);
    if fit {
        ww = w.min(gw);
        wh = h.min(gh);
        x = x.max(gx).min(gx + gw - ww);
        y = y.max(gy).min(gy + gh - wh);
    }
    let (x, y) = (x.round(), y.round());
    let lay = json!({"dock": dock, "ax": (anchor.0 - x) / z, "ay": (anchor.1 - y) / z, "grow": grow,
        "scr": {"x": (gx - x) / z, "y": (gy - y) / z, "w": gw / z, "h": gh / z}});
    ((x, y), (ww.round() as u32, wh.round() as u32), lay)
}

/// Hitung perpindahan (tanpa menyentuh jendela; dipanggil sambil memegang kunci)
fn plan_move(ws: &mut WinState, pos: (f64, f64), size: (u32, u32), sf: f64) -> (Option<(u32, u32)>, (i32, i32)) {
    let resize = if ws.size != size || (sf - ws.sf).abs() > 1e-6 { Some(size) } else { None };
    ws.sf = sf;
    ws.size = size;
    ws.pos = pos;
    (resize, (pos.0 as i32, pos.1 as i32))
}

/// Terapkan perpindahan (dipanggil SETELAH kunci dilepas)
fn apply_move(core: &Core, mv: (Option<(u32, u32)>, (i32, i32))) {
    let Some(w) = core.window() else { return };
    if let Some((a, b)) = mv.0 {
        let _ = w.set_size(PhysicalSize::new(a, b));
    }
    let _ = w.set_position(PhysicalPosition::new(mv.1 .0, mv.1 .1));
}

pub fn place(core: &Core, dragging: bool) {
    let all = monitors(core);
    let prim = primary(core);
    let mut ws = core.win.lock().unwrap();
    let Some(m) = screen_in(&all, prim, &ws) else { return };
    let dock = jstr(&ws.st, &["dock"]);
    let (pos, size, mut lay) = layout_for(&ws, if dock.is_empty() { "top" } else { &dock }, &m, None, None, true);
    let mv = plan_move(&mut ws, pos, size, m.sf);
    lay["dragging"] = json!(dragging);
    ws.layout = lay.clone();
    drop(ws);
    apply_move(core, mv);
    let _ = core.app.emit("layout", lay.to_string());
}

/// Ukuran berubah (Pengaturan → Tampilan → Ukuran notch)
pub fn apply_zoom(core: &Core, zoom: f64) {
    {
        let mut ws = core.win.lock().unwrap();
        ws.zoom = zoom;
        ws.sf = 0.0; // paksa ukuran dihitung ulang
    }
    if let Some(w) = core.window() {
        let _ = w.set_zoom(zoom);
    }
    place(core, false);
}

pub fn save_state(ws: &WinState) {
    write_json(&p(&["state.json"]), &ws.st);
}

pub fn set_dock(core: &Core, dock: &str) {
    let prim = primary(core);
    {
        let mut ws = core.win.lock().unwrap();
        if dock == "reset" {
            ws.st["dock"] = json!("top");
            ws.st["along"] = json!(0.5);
            if let Some(pm) = prim {
                ws.st["screen"] = json!(pm.name);
            }
        } else if ["top", "bottom", "left", "right", "float"].contains(&dock) {
            ws.st["dock"] = json!(dock);
            ws.st["along"] = json!(0.5);
            if dock == "float" {
                ws.st["fx"] = json!(0.5);
                ws.st["fy"] = json!(0.18);
            }
        }
        save_state(&ws);
    }
    place(core, false);
}

fn cursor(core: &Core) -> Option<(f64, f64)> {
    core.app.cursor_position().ok().map(|c| (c.x, c.y))
}

pub fn drag_start(core: &Core, ox: f64, oy: f64) {
    let mut ws = core.win.lock().unwrap();
    let z = ws.zoom * ws.sf.max(0.5);
    ws.drag = Some(Drag { off: (ox * z, oy * z), dock: None, sname: String::new(), along: None, center: (0.0, 0.0), mon: None, last: None });
    drop(ws);
    set_ignore(core, false);
}

fn drag_tick(core: &Core) {
    let Some(cur) = cursor(core) else { return };
    let mons = monitors(core);
    let prim = primary(core);
    let mut ws = core.win.lock().unwrap();
    if ws.drag.is_none() {
        return;
    }
    let m = mons
        .iter()
        .find(|m| cur.0 >= m.full.0 && cur.0 < m.full.0 + m.full.2 && cur.1 >= m.full.1 && cur.1 < m.full.1 + m.full.3)
        .cloned()
        .or_else(|| screen_in(&mons, prim, &ws));
    let Some(m) = m else { return };
    let (gx, gy, gw, gh) = m.work;
    let t = 46.0 * m.sf;
    let off = ws.drag.as_ref().unwrap().off;
    let center = (cur.0 - off.0, cur.1 - off.1);
    let dock = if cur.1 - gy < t {
        "top"
    } else if gy + gh - cur.1 < t {
        "bottom"
    } else if cur.0 - gx < t {
        "left"
    } else if gx + gw - cur.0 < t {
        "right"
    } else {
        "float"
    };
    let along = match dock {
        "top" | "bottom" => Some(((center.0 - gx) / gw.max(1.0)).clamp(0.0, 1.0)),
        "left" | "right" => Some(((center.1 - gy) / gh.max(1.0)).clamp(0.0, 1.0)),
        _ => None,
    };
    let (pos, size, mut lay) = layout_for(&ws, dock, &m, along, Some(center), false);
    let size_changed = size != ws.size;
    let mv = plan_move(&mut ws, pos, size, m.sf);
    let d = ws.drag.as_mut().unwrap();
    d.along = along;
    d.center = center;
    d.last = Some(dock.into());
    let emit_now = d.dock.as_deref() != Some(dock) || d.sname != m.name || size_changed;
    if emit_now {
        d.dock = Some(dock.into());
        d.sname = m.name.clone();
    }
    d.mon = Some(m);
    if emit_now {
        lay["dragging"] = json!(true);
        ws.layout = lay.clone();
    }
    drop(ws);
    apply_move(core, mv);
    if emit_now {
        let _ = core.app.emit("layout", lay.to_string());
    }
}

pub fn drag_end(core: &Core) {
    {
        let mut ws = core.win.lock().unwrap();
        let Some(d) = ws.drag.take() else { return };
        if let (Some(last), Some(m)) = (d.last.clone(), d.mon.clone()) {
            let (gx, gy, gw, gh) = m.work;
            ws.st["screen"] = json!(m.name);
            ws.st["dock"] = json!(last);
            if last == "float" {
                let z = ws.zoom * m.sf;
                let (mx, my) = (140.0 * z, 30.0 * z);
                let cx = d.center.0.max(gx + mx).min(gx + gw - mx);
                let cy = d.center.1.max(gy + my).min(gy + gh - my);
                ws.st["fx"] = json!((cx - gx) / gw.max(1.0));
                ws.st["fy"] = json!((cy - gy) / gh.max(1.0));
            } else {
                ws.st["along"] = json!(d.along.unwrap_or(0.5).clamp(0.03, 0.97));
            }
            save_state(&ws);
        }
    }
    place(core, false);
}

pub fn set_rect(core: &Core, x: f64, y: f64, w: f64, h: f64) {
    core.win.lock().unwrap().rect = Some([x, y, w, h]);
}

fn set_ignore(core: &Core, ignore: bool) {
    let mut ws = core.win.lock().unwrap();
    if ws.ignoring == Some(ignore) {
        return;
    }
    ws.ignoring = Some(ignore);
    drop(ws);
    if let Some(w) = core.window() {
        let _ = w.set_ignore_cursor_events(ignore);
    }
}

/// Dipanggil terus-menerus dari thread latar: seret, klik-tembus, dan posisi kursor untuk mata Notnot.
pub fn ui_loop(core: std::sync::Arc<Core>) {
    let mut last_feed = 0.0f64;
    let mut last_inside = false;
    let mut last_active: Option<bool> = None;
    let mut last_active_check = 0.0f64;
    loop {
        let dragging = core.win.lock().unwrap().drag.is_some();
        if dragging {
            drag_tick(&core);
        }
        let (visible, rect, pos, z) = {
            let ws = core.win.lock().unwrap();
            (ws.visible, ws.rect, ws.pos, ws.zoom * ws.sf.max(0.5))
        };
        if visible {
            if let Some(cur) = cursor(&core) {
                // klik-tembus di luar notch
                let inside = dragging
                    || rect
                        .map(|r| {
                            let (x0, y0) = (pos.0 + r[0] * z - 2.0, pos.1 + r[1] * z - 2.0);
                            cur.0 >= x0 && cur.1 >= y0 && cur.0 <= x0 + r[2] * z + 4.0 && cur.1 <= y0 + r[3] * z + 4.0
                        })
                        .unwrap_or(false);
                set_ignore(&core, !inside);
                // kursor benar-benar keluar dari notch: beri tahu antarmuka (WebView2 kadang tidak mengirim "pointerleave"
                // setelah jendela dibuat tembus klik, sehingga panel tidak menutup sendiri)
                if last_inside && !inside {
                    let _ = core.app.emit("hoverOut", true);
                }
                last_inside = inside;
                // kursor untuk mata Notnot (~30x per detik)
                let t = now_s();
                if !dragging && t - last_feed > 0.033 {
                    last_feed = t;
                    let want = {
                        let c = core.cfg.lock().unwrap();
                        jbool(&c, &["mascot", "on"], true) && jbool(&c, &["mascot", "eyes"], true)
                    };
                    if want {
                        let (x, y) = (((cur.0 - pos.0) / z) as i64, ((cur.1 - pos.1) / z) as i64);
                        let mut ws = core.win.lock().unwrap();
                        let moved = ws.last_cursor.map(|l| (x - l.0).abs() >= 2 || (y - l.1).abs() >= 2).unwrap_or(true);
                        if moved {
                            ws.last_cursor = Some((x, y));
                            drop(ws);
                            let _ = core.app.emit("cursor", format!("{},{}", x, y));
                        }
                    }
                }
            }
        }
        // jendela aktif atau tidak, dibaca langsung dari Windows (sinyal fokus WebView2 bisa meleset saat diklik)
        #[cfg(windows)]
        {
            let t = now_s();
            if t - last_active_check > 0.1 {
                last_active_check = t;
                if let Some(w) = core.window() {
                    if let Ok(h) = w.hwnd() {
                        let a = crate::sys::is_foreground(h.0 as *mut std::ffi::c_void);
                        if last_active != Some(a) {
                            last_active = Some(a);
                            let _ = core.app.emit("active", a);
                        }
                    }
                }
            }
        }
        #[cfg(not(windows))]
        let _ = (&mut last_active, &mut last_active_check);
        std::thread::sleep(std::time::Duration::from_millis(if dragging { 10 } else { 16 }));
    }
}

pub fn activate(core: &Core) {
    if let Some(w) = core.window() {
        let _ = w.set_focus();
        #[cfg(windows)]
        if let Ok(h) = w.hwnd() {
            crate::sys::force_foreground(h.0 as *mut std::ffi::c_void);
        }
    }
}

pub fn keep_top(core: &Core) {
    let ws = core.win.lock().unwrap();
    if !ws.visible || ws.drag.is_some() {
        return;
    }
    drop(ws);
    #[cfg(windows)]
    if let Some(w) = core.window() {
        if let Ok(h) = w.hwnd() {
            crate::sys::keep_top(h.0 as *mut std::ffi::c_void);
        }
    }
}

pub fn force_show(core: &Core) {
    let mut ws = core.win.lock().unwrap();
    ws.force_until = now_s() + 40.0;
    if ws.fs_hidden {
        ws.fs_hidden = false;
        ws.visible = true;
        drop(ws);
        if let Some(w) = core.window() {
            let _ = w.show();
        }
    }
}

pub fn check_fullscreen(core: &Core) {
    let hide_opt = jbool(&core.cfg.lock().unwrap(), &["notch", "hideFullscreen"], false);
    let mut ws = core.win.lock().unwrap();
    let want_hide = hide_opt && now_s() > ws.force_until && ws.drag.is_none() && crate::sys::foreground_is_fullscreen();
    if want_hide && !ws.fs_hidden {
        ws.fs_hidden = true;
        ws.visible = false;
        drop(ws);
        if let Some(w) = core.window() {
            let _ = w.hide();
        }
    } else if !want_hide && ws.fs_hidden {
        ws.fs_hidden = false;
        ws.visible = true;
        drop(ws);
        if let Some(w) = core.window() {
            let _ = w.show();
        }
    }
}

/// Kalau monitor dicabut/ditambah atau resolusi berubah, atur ulang posisi.
pub fn check_monitors(core: &Core) {
    let sig = monitors(core).iter().map(|m| format!("{}:{:?}:{:?}:{}", m.name, m.full, m.work, m.sf)).collect::<Vec<_>>().join("|");
    let changed = {
        let mut ws = core.win.lock().unwrap();
        let ch = !ws.mon_sig.is_empty() && ws.mon_sig != sig;
        ws.mon_sig = sig;
        ch && ws.drag.is_none()
    };
    if changed {
        log("monitor berubah, atur ulang posisi");
        place(core, false);
    }
}

pub fn show(core: &Core) {
    core.win.lock().unwrap().visible = true;
    if let Some(w) = core.window() {
        let _ = w.show();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    /// Notch harus selalu berada di dalam jendela dan di dalam layar, di posisi mana pun.
    #[test]
    fn notch_selalu_di_dalam_jendela() {
        for sf in [1.0, 1.25, 1.5, 1.75] {
            let m = Mon { name: "A".into(), full: (0.0, 0.0, 1920.0, 1080.0), work: (0.0, 0.0, 1920.0, 1032.0), sf };
            for dock in ["top", "bottom", "left", "right", "float"] {
                let w = WinState { st: json!({"dock": dock, "along": 0.5, "fx": 0.5, "fy": 0.5}), zoom: 1.0, sf: 0.0, pos: (0.0, 0.0), size: (0, 0), drag: None,
                    rect: None, fs_hidden: false, force_until: 0.0, last_cursor: None, ignoring: None, layout: json!({}), mon_sig: String::new(), visible: true };
                let ((x, y), (ww, wh), lay) = layout_for(&w, dock, &m, None, None, true);
                let (ax, ay) = (lay["ax"].as_f64().unwrap(), lay["ay"].as_f64().unwrap());
                let (cw, ch) = (ww as f64 / sf, wh as f64 / sf);
                assert!(x >= 0.0 && y >= 0.0 && x + ww as f64 <= 1920.5 && y + wh as f64 <= 1032.5, "{dock} {sf}: jendela di luar layar");
                assert!(ax >= -0.5 && ax <= cw + 0.5 && ay >= -0.5 && ay <= ch + 0.5, "{dock} {sf}: jangkar ({ax},{ay}) di luar jendela {cw}x{ch}");
                let (sx, sy) = (x + ax * sf, y + ay * sf);
                let ok = match dock {
                    "top" => sy.abs() < 1.0 && (sx - 960.0).abs() < 1.0,
                    "bottom" => (sy - 1032.0).abs() < 1.0 && (sx - 960.0).abs() < 1.0,
                    "left" => sx.abs() < 1.0 && (sy - 516.0).abs() < 1.0,
                    "right" => (sx - 1920.0).abs() < 1.0 && (sy - 516.0).abs() < 1.0,
                    _ => (sx - 960.0).abs() < 1.0 && (sy - 516.0).abs() < 1.0,
                };
                assert!(ok, "{dock} {sf}: titik notch di layar ({sx},{sy}) salah");
            }
        }
    }
}
