//! Fungsi khusus Windows (jendela aktif, idle, layar penuh, DPAPI, autostart, baterai, ...).
//! Di sistem lain fungsi-fungsi ini mengembalikan nilai netral supaya kode tetap bisa diuji.

#[allow(unused_imports)]
use crate::store::{log, VERSION};

#[cfg(windows)]
mod imp {
    use super::*;
    use std::ffi::c_void;
    use windows::core::{BOOL, PCWSTR, PWSTR};
    use windows::Win32::Foundation::{CloseHandle, HLOCAL, HWND, LPARAM, LocalFree, RECT};
    use windows::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST};
    use windows::Win32::Security::Cryptography::{CryptProtectData, CryptUnprotectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN};
    use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
    use windows::Win32::System::SystemInformation::GetTickCount;
    use windows::Win32::System::Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION};
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    use windows::Win32::UI::Shell::{SHQueryUserNotificationState, QUNS_PRESENTATION_MODE, QUNS_RUNNING_D3D_FULL_SCREEN};
    use windows::Win32::UI::WindowsAndMessaging::*;

    pub fn hwnd_from(raw: *mut c_void) -> HWND {
        HWND(raw)
    }

    fn window_text(h: HWND) -> String {
        unsafe {
            let n = GetWindowTextLengthW(h);
            if n <= 0 {
                return String::new();
            }
            let mut buf = vec![0u16; n as usize + 1];
            let got = GetWindowTextW(h, &mut buf);
            String::from_utf16_lossy(&buf[..got.max(0) as usize])
        }
    }

    fn process_name(pid: u32) -> String {
        unsafe {
            let Ok(h) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else { return String::new() };
            let mut buf = vec![0u16; 1024];
            let mut len = buf.len() as u32;
            let ok = QueryFullProcessImageNameW(h, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut len).is_ok();
            let _ = CloseHandle(h);
            if !ok {
                return String::new();
            }
            let full = String::from_utf16_lossy(&buf[..len as usize]);
            full.rsplit(['\\', '/']).next().unwrap_or("").to_lowercase()
        }
    }

    /// (nama proses huruf kecil, judul jendela, pid) dari jendela yang sedang aktif
    pub fn foreground_info() -> (String, String, u32) {
        unsafe {
            let h = GetForegroundWindow();
            if h.0.is_null() {
                return (String::new(), String::new(), 0);
            }
            let mut pid = 0u32;
            GetWindowThreadProcessId(h, Some(&mut pid as *mut u32));
            (process_name(pid), window_text(h), pid)
        }
    }

    pub fn idle_seconds() -> f64 {
        unsafe {
            let mut lii = LASTINPUTINFO { cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32, dwTime: 0 };
            if !GetLastInputInfo(&mut lii).as_bool() {
                return 0.0;
            }
            (GetTickCount().wrapping_sub(lii.dwTime)) as f64 / 1000.0
        }
    }

    /// True hanya untuk layar penuh sungguhan (game, video, presentasi), bukan jendela maximize.
    pub fn foreground_is_fullscreen() -> bool {
        unsafe {
            if let Ok(st) = SHQueryUserNotificationState() {
                if st == QUNS_RUNNING_D3D_FULL_SCREEN || st == QUNS_PRESENTATION_MODE {
                    return true;
                }
            }
            let h = GetForegroundWindow();
            if h.0.is_null() {
                return false;
            }
            let mut pid = 0u32;
            GetWindowThreadProcessId(h, Some(&mut pid as *mut u32));
            if pid == std::process::id() {
                return false;
            }
            let mut cls = [0u16; 256];
            let n = GetClassNameW(h, &mut cls);
            let cname = String::from_utf16_lossy(&cls[..n.max(0) as usize]);
            if ["Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd"].contains(&cname.as_str()) {
                return false;
            }
            if IsZoomed(h).as_bool() {
                return false;
            }
            if (GetWindowLongW(h, GWL_STYLE) as u32 & 0x00C0_0000) == 0x00C0_0000 {
                return false;
            }
            let mut r = RECT::default();
            if GetWindowRect(h, &mut r).is_err() {
                return false;
            }
            let mut mi = MONITORINFO { cbSize: std::mem::size_of::<MONITORINFO>() as u32, ..Default::default() };
            if !GetMonitorInfoW(MonitorFromWindow(h, MONITOR_DEFAULTTONEAREST), &mut mi).as_bool() {
                return false;
            }
            let m = mi.rcMonitor;
            r.left <= m.left && r.top <= m.top && r.right >= m.right && r.bottom >= m.bottom
        }
    }

    /// Cari judul jendela yang memuat judul lagu (untuk menebak YouTube/Spotify di browser)
    pub fn window_titles_containing(key: &str) -> Vec<String> {
        struct Ctx {
            key: String,
            found: Vec<String>,
        }
        unsafe extern "system" fn cb(h: HWND, lp: LPARAM) -> BOOL {
            let ctx = &mut *(lp.0 as *mut Ctx);
            if !IsWindowVisible(h).as_bool() {
                return BOOL(1);
            }
            let t = window_text(h).to_lowercase();
            if !ctx.key.is_empty() && t.contains(&ctx.key) {
                ctx.found.push(t);
                return BOOL(0);
            }
            BOOL(1)
        }
        let mut ctx = Ctx { key: key.to_string(), found: vec![] };
        unsafe {
            let _ = EnumWindows(Some(cb), LPARAM(&mut ctx as *mut Ctx as isize));
        }
        ctx.found
    }

    pub fn keep_top(raw: *mut c_void) {
        unsafe {
            let _ = SetWindowPos(hwnd_from(raw), Some(HWND_TOPMOST), 0, 0, 0, 0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOOWNERZORDER);
        }
    }

    /// Apakah jendela aktif (foreground) adalah jendela ini atau milik jendela ini
    pub fn is_foreground(raw: *mut c_void) -> bool {
        unsafe {
            let fg = GetForegroundWindow();
            if fg.0.is_null() {
                return false;
            }
            let me = hwnd_from(raw);
            fg == me || GetAncestor(fg, GA_ROOTOWNER) == me || GetAncestor(fg, GA_ROOT) == me
        }
    }

    pub fn force_foreground(raw: *mut c_void) {
        unsafe {
            let _ = SetForegroundWindow(hwnd_from(raw));
        }
    }

    pub fn dpapi(data: &[u8], protect: bool) -> Option<Vec<u8>> {
        unsafe {
            let inp = CRYPT_INTEGER_BLOB { cbData: data.len() as u32, pbData: data.as_ptr() as *mut u8 };
            let mut out = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
            let ok = if protect {
                CryptProtectData(&inp, PCWSTR::null(), None, None, None, CRYPTPROTECT_UI_FORBIDDEN, &mut out).is_ok()
            } else {
                CryptUnprotectData(&inp, None, None, None, None, CRYPTPROTECT_UI_FORBIDDEN, &mut out).is_ok()
            };
            if !ok || out.pbData.is_null() {
                return None;
            }
            let v = std::slice::from_raw_parts(out.pbData, out.cbData as usize).to_vec();
            let _ = LocalFree(Some(HLOCAL(out.pbData as *mut c_void)));
            Some(v)
        }
    }

    pub fn battery() -> Option<(i64, bool)> {
        unsafe {
            let mut s = SYSTEM_POWER_STATUS::default();
            if GetSystemPowerStatus(&mut s).is_err() {
                return None;
            }
            if s.BatteryFlag & 128 != 0 || s.BatteryLifePercent == 255 {
                return None;
            }
            Some((s.BatteryLifePercent as i64, s.ACLineStatus == 1))
        }
    }

    // ---------------------------------------------------------------- autostart
    const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
    const APP_KEY: &str = r"Software\NotchNote";

    pub fn autostart_command() -> String {
        let exe = std::env::current_exe().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
        format!("\"{}\"", exe)
    }

    pub fn reg_get(name: &str) -> Option<String> {
        use winreg::{enums::HKEY_CURRENT_USER, RegKey};
        RegKey::predef(HKEY_CURRENT_USER).open_subkey(RUN_KEY).ok()?.get_value::<String, _>(name).ok()
    }

    pub fn reg_set(name: &str, value: Option<&str>) -> bool {
        use winreg::{enums::*, RegKey};
        let Ok(k) = RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags(RUN_KEY, KEY_SET_VALUE) else { return false };
        match value {
            Some(v) => k.set_value(name, &v.to_string()).is_ok(),
            None => {
                let _ = k.delete_value(name);
                true
            }
        }
    }

    fn app_reg(name: &str, value: Option<&str>) -> Option<String> {
        use winreg::{enums::*, RegKey};
        let hk = RegKey::predef(HKEY_CURRENT_USER);
        if let Some(v) = value {
            let (k, _) = hk.create_subkey(APP_KEY).ok()?;
            k.set_value(name, &v.to_string()).ok()?;
            return Some(v.to_string());
        }
        hk.open_subkey(APP_KEY).ok()?.get_value::<String, _>(name).ok()
    }

    pub fn set_autostart(on: bool) -> bool {
        let cmd = autostart_command();
        let ok = reg_set(crate::store::APP, if on { Some(cmd.as_str()) } else { None });
        if on {
            app_reg("AutostartVersion", Some(VERSION));
        }
        ok
    }

    /// Pastikan autostart menunjuk ke aplikasi ini, bukan ke folder versi Python lama.
    pub fn fix_autostart() {
        let mut cur = reg_get(crate::store::APP);
        if reg_get("PulauFokus").is_some() {
            reg_set("PulauFokus", None);
            cur = cur.or(Some("lama".into()));
        }
        let Some(cur) = cur else { return };
        if cur == autostart_command() {
            return;
        }
        let stored = app_reg("AutostartVersion", None).unwrap_or_else(|| "0".into());
        if super::vtuple(VERSION) >= super::vtuple(&stored) || cur.to_lowercase().contains("python") || cur.to_lowercase().contains(".py") {
            set_autostart(true);
            log(format!("autostart dipindah dari {} ke {}", cur, autostart_command()));
        }
    }

    /// Tutup NotchNote / Pulau Fokus versi Python yang masih berjalan.
    pub fn stop_python_copies() -> usize {
        use sysinfo::System;
        let mut s = System::new();
        s.refresh_processes();
        let mut n = 0;
        for (pid, pr) in s.processes() {
            if pid.as_u32() == std::process::id() {
                continue;
            }
            let name = pr.name().to_lowercase();
            if !name.starts_with("python") {
                continue;
            }
            let hit = pr.cmd().iter().skip(1).take(3).any(|a| {
                let a = a.to_lowercase();
                a.ends_with("notchnote.py") || a.ends_with("notchnote.pyw") || a.ends_with("pulau_fokus.py") || a.ends_with("pulau_fokus.pyw")
            });
            if hit {
                log(format!("menghentikan versi Python {} {}", pid, pr.cmd().join(" ")));
                pr.kill();
                n += 1;
            }
        }
        n
    }

    // ---------------------------------------------------------------- suara
    pub fn play_wav(path: &str, looped: bool) {
        use windows::Win32::Media::Audio::{PlaySoundW, SND_ASYNC, SND_FILENAME, SND_LOOP, SND_NODEFAULT};
        let w: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
        let mut f = SND_FILENAME | SND_ASYNC | SND_NODEFAULT;
        if looped {
            f |= SND_LOOP;
        }
        unsafe {
            let _ = PlaySoundW(PCWSTR(w.as_ptr()), None, f);
        }
    }

    pub fn stop_sound() {
        use windows::Win32::Media::Audio::{PlaySoundW, SND_FLAGS};
        unsafe {
            let _ = PlaySoundW(PCWSTR::null(), None, SND_FLAGS(0));
        }
    }

    // ---------------------------------------------------------------- clipboard
    pub fn clipboard_seq() -> u32 {
        unsafe { windows::Win32::System::DataExchange::GetClipboardSequenceNumber() }
    }

    /// Pengelola kata sandi menandai isi clipboard supaya tidak direkam
    pub fn clipboard_excluded() -> bool {
        use windows::core::w;
        use windows::Win32::System::DataExchange::{IsClipboardFormatAvailable, RegisterClipboardFormatW};
        unsafe {
            for f in [w!("ExcludeClipboardContentFromMonitorProcessing"), w!("Clipboard Viewer Ignore")] {
                let id = RegisterClipboardFormatW(f);
                if id != 0 && IsClipboardFormatAvailable(id).is_ok() {
                    return true;
                }
            }
        }
        false
    }
}

#[cfg(not(windows))]
#[allow(dead_code)]
mod imp {
    use std::ffi::c_void;
    pub fn foreground_info() -> (String, String, u32) { (String::new(), String::new(), 0) }
    pub fn idle_seconds() -> f64 { 0.0 }
    pub fn foreground_is_fullscreen() -> bool { false }
    pub fn window_titles_containing(_key: &str) -> Vec<String> { vec![] }
    pub fn keep_top(_raw: *mut c_void) {}
    pub fn force_foreground(_raw: *mut c_void) {}
    pub fn is_foreground(_raw: *mut c_void) -> bool { false }
    pub fn dpapi(_data: &[u8], _protect: bool) -> Option<Vec<u8>> { None }
    pub fn battery() -> Option<(i64, bool)> { None }
    pub fn reg_get(_name: &str) -> Option<String> { None }
    pub fn set_autostart(_on: bool) -> bool { false }
    pub fn fix_autostart() {}
    pub fn stop_python_copies() -> usize { 0 }
    pub fn play_wav(_path: &str, _looped: bool) {}
    pub fn stop_sound() {}
    pub fn clipboard_seq() -> u32 { 0 }
    pub fn clipboard_excluded() -> bool { false }
}

pub use imp::*;

#[allow(dead_code)]
pub fn vtuple(v: &str) -> Vec<u32> {
    v.split(|c: char| !c.is_ascii_digit()).filter(|s| !s.is_empty()).take(3).filter_map(|s| s.parse().ok()).collect()
}
