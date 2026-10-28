//! Penjaga: kalau NotchNote berhenti mendadak, catat penyebabnya di notchnote.log lalu buka lagi otomatis.
//!
//! Saat aplikasi mulai, ia menjalankan salinan kecil dirinya sendiri dengan argumen `--jaga <pid>`.
//! Salinan itu tidak membuka jendela apa pun; ia hanya menunggu aplikasi utama selesai.
//! - Keluar lewat menu "Keluar" (kode 0) atau diakhiri dari Task Manager (kode 1): tidak dibuka lagi.
//! - Berhenti karena galat (kode 0xC000....): penyebab dicatat, aplikasi dibuka lagi (maks. 3x per 10 menit).

#[allow(unused_imports)]
use crate::store::{log, now_s, p, read_json, write_json};

pub const ARG: &str = "--jaga";
pub const RESTORED: &str = "--dipulihkan";

/// Dipanggil paling awal di main(). Kalau proses ini adalah penjaga, jalankan penjaga lalu kembalikan true.
pub fn run_watcher_if_asked() -> bool {
    let mut args = std::env::args().skip(1);
    if args.next().as_deref() != Some(ARG) {
        return false;
    }
    let _pid: u32 = args.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    #[cfg(windows)]
    imp::watch(_pid);
    true
}

/// Catat galat sistem (bukan panic Rust) dan pesan error bawaan Rust ke file, lalu jalankan penjaga.
pub fn start() {
    let restored = std::env::args().any(|a| a == RESTORED);
    log(format!(
        "mulai versi {} (pid {}){}",
        crate::store::VERSION,
        std::process::id(),
        if restored { " - dibuka ulang otomatis setelah berhenti mendadak" } else { "" }
    ));
    #[cfg(windows)]
    {
        imp::install();
        imp::spawn();
    }
}

/// Arti kode keluar Windows yang paling sering, untuk catatan.
#[allow(dead_code)]
pub fn meaning(code: u32) -> &'static str {
    match code {
        0xC000_0005 => "akses memori tidak sah",
        0xC000_00FD => "stack penuh",
        0xC000_0409 => "dihentikan paksa oleh program (abort / fail-fast)",
        0xC000_0374 => "heap rusak",
        0xC000_001D => "instruksi tidak dikenal",
        0xC000_0094 => "pembagian dengan nol",
        0xC000_041D => "galat di dalam callback Windows",
        0xC000_0602 => "galat fatal (fail-fast)",
        0xE06D_7363 => "exception C++ tidak tertangani",
        0x8000_0003 => "breakpoint",
        _ => "",
    }
}

#[cfg(windows)]
mod imp {
    use super::*;
    use std::os::windows::io::IntoRawHandle;
    use std::os::windows::process::CommandExt;
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{CloseHandle, HANDLE, HMODULE};
    use windows::Win32::System::Console::{SetStdHandle, STD_ERROR_HANDLE};
    use windows::Win32::System::Diagnostics::Debug::{SetUnhandledExceptionFilter, EXCEPTION_POINTERS};
    use windows::Win32::System::LibraryLoader::{GetModuleFileNameW, GetModuleHandleExW, GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS, GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT};
    use windows::Win32::System::Threading::{GetExitCodeProcess, OpenProcess, WaitForSingleObject, INFINITE, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SYNCHRONIZE};
    use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_SHUTTINGDOWN};

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    pub fn install() {
        // Pesan Rust seperti "thread has overflowed its stack" ditulis ke stderr; aplikasi tanpa konsol
        // tidak punya stderr, jadi arahkan ke file supaya bisa dibaca setelah kejadian.
        if let Ok(f) = std::fs::OpenOptions::new().create(true).write(true).truncate(true).open(p(&["stderr.log"])) {
            let h = f.into_raw_handle();
            unsafe {
                let _ = SetStdHandle(STD_ERROR_HANDLE, HANDLE(h));
            }
        }
        unsafe {
            let _ = SetUnhandledExceptionFilter(Some(filter));
        }
    }

    unsafe extern "system" fn filter(info: *const EXCEPTION_POINTERS) -> i32 {
        let rec = unsafe { info.as_ref().and_then(|i| i.ExceptionRecord.as_ref()) };
        if let Some(rec) = rec {
            let code = rec.ExceptionCode.0 as u32;
            let addr = rec.ExceptionAddress as usize;
            let mut module = String::from("?");
            let mut off = addr;
            let mut hm = HMODULE(std::ptr::null_mut());
            let ok = unsafe {
                GetModuleHandleExW(
                    GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
                    PCWSTR(addr as *const u16),
                    &mut hm,
                )
                .is_ok()
            };
            if ok {
                let mut buf = [0u16; 260];
                let n = unsafe { GetModuleFileNameW(Some(hm), &mut buf) } as usize;
                let full = String::from_utf16_lossy(&buf[..n.min(buf.len())]);
                module = full.rsplit(['\\', '/']).next().unwrap_or("?").to_string();
                off = addr.wrapping_sub(hm.0 as usize);
            }
            let extra = if code == 0xC000_0005 && rec.NumberParameters >= 2 {
                let kind = match rec.ExceptionInformation[0] {
                    0 => "baca",
                    1 => "tulis",
                    8 => "eksekusi",
                    _ => "?",
                };
                format!(" ({} alamat 0x{:X})", kind, rec.ExceptionInformation[1])
            } else {
                String::new()
            };
            let th = std::thread::current().name().unwrap_or("tanpa nama").to_string();
            log(format!("GALAT 0x{:08X} {} di {}+0x{:X}{} | thread {}", code, meaning(code), module, off, extra, th));
        }
        0 // EXCEPTION_CONTINUE_SEARCH: biarkan Windows menutup proses seperti biasa
    }

    pub fn spawn() {
        let Ok(exe) = std::env::current_exe() else { return };
        let r = std::process::Command::new(exe)
            .arg(ARG)
            .arg(std::process::id().to_string())
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
        if let Err(e) = r {
            log(format!("penjaga tidak bisa dijalankan: {}", e));
        }
    }

    pub fn watch(pid: u32) {
        let code = unsafe {
            let Ok(h) = OpenProcess(PROCESS_SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else { return };
            WaitForSingleObject(h, INFINITE);
            let mut code = 0u32;
            let _ = GetExitCodeProcess(h, &mut code);
            let _ = CloseHandle(h);
            code
        };
        // 0 = keluar biasa, 1 = diakhiri dari Task Manager / installer; kode galat Windows dimulai dari 0x80000000
        if code < 0x8000_0000 {
            return;
        }
        if unsafe { GetSystemMetrics(SM_SHUTTINGDOWN) } != 0 {
            return;
        }
        log(format!("NotchNote berhenti mendadak (kode 0x{:08X} {})", code, meaning(code)));
        if let Ok(s) = std::fs::read_to_string(p(&["stderr.log"])) {
            let s = s.trim();
            if !s.is_empty() {
                let tail: String = s.chars().rev().take(800).collect::<Vec<_>>().into_iter().rev().collect();
                log(format!("pesan terakhir: {}", tail.replace(['\r', '\n'], " | ")));
            }
        }
        // jangan berputar terus kalau aplikasi langsung berhenti lagi
        let path = p(&["restarts.json"]);
        let now = now_s();
        let mut list: Vec<f64> = read_json(&path, serde_json::json!([]))
            .as_array()
            .map(|a| a.iter().filter_map(|x| x.as_f64()).filter(|t| now - t < 600.0).collect())
            .unwrap_or_default();
        if list.len() >= 3 {
            log("tidak dibuka ulang otomatis: sudah 3 kali berhenti dalam 10 menit");
            return;
        }
        list.push(now);
        write_json(&path, &serde_json::json!(list));
        std::thread::sleep(std::time::Duration::from_millis(1500));
        let Ok(exe) = std::env::current_exe() else { return };
        match std::process::Command::new(exe).arg(RESTORED).creation_flags(0).spawn() {
            Ok(_) => log("NotchNote dibuka ulang otomatis"),
            Err(e) => log(format!("gagal membuka ulang: {}", e)),
        }
    }
}
