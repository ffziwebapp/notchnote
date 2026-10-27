//! Bunyi pengingat & alarm (WAV dibuat sendiri, diputar dengan PlaySound Windows).

use crate::store::{log, p};
use crate::sys;
use std::f64::consts::PI;
use std::sync::atomic::{AtomicU64, Ordering};

static GEN: AtomicU64 = AtomicU64::new(0);

fn make_wav(path: &std::path::Path, notes: &[(f64, f64, f64)], total: f64, vol: f64) -> std::io::Result<()> {
    let sr = 22050u32;
    let n = (sr as f64 * total) as usize;
    let mut buf = vec![0f64; n];
    for &(f, start, dur) in notes {
        let i0 = (start * sr as f64) as usize;
        for i in 0..(dur * sr as f64) as usize {
            let t = i as f64 / sr as f64;
            let env = (t / 0.008).min(1.0) * (-t * 6.5).exp();
            let v = (2.0 * PI * f * t).sin() + 0.3 * (4.0 * PI * f * t).sin();
            if i0 + i < n {
                buf[i0 + i] += vol * env * v;
            }
        }
    }
    let data: Vec<u8> = buf.iter().flat_map(|v| ((v.clamp(-1.0, 1.0) * 32000.0) as i16).to_le_bytes()).collect();
    let mut out = Vec::with_capacity(44 + data.len());
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&(36 + data.len() as u32).to_le_bytes());
    out.extend_from_slice(b"WAVEfmt ");
    out.extend_from_slice(&16u32.to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes()); // PCM
    out.extend_from_slice(&1u16.to_le_bytes()); // mono
    out.extend_from_slice(&sr.to_le_bytes());
    out.extend_from_slice(&(sr * 2).to_le_bytes());
    out.extend_from_slice(&2u16.to_le_bytes());
    out.extend_from_slice(&16u16.to_le_bytes());
    out.extend_from_slice(b"data");
    out.extend_from_slice(&(data.len() as u32).to_le_bytes());
    out.extend_from_slice(&data);
    std::fs::write(path, out)
}

fn builtin(kind: &str) -> String {
    let path = p(&["sounds", &format!("{}.wav", kind)]);
    if !path.is_file() {
        let r = if kind == "alarm" {
            make_wav(&path, &[(880.0, 0.0, 0.22), (1318.5, 0.24, 0.22), (880.0, 0.52, 0.22), (1318.5, 0.76, 0.42)], 1.7, 0.3)
        } else {
            make_wav(&path, &[(1046.5, 0.0, 0.5), (1568.0, 0.16, 0.9)], 1.3, 0.24)
        };
        if let Err(e) = r {
            log(format!("make_wav {}", e));
            return String::new();
        }
    }
    path.to_string_lossy().to_string()
}

pub fn play(file: &str, kind: &str, looped: bool, secs: i64) {
    let custom = kind == "file" && !file.is_empty() && std::path::Path::new(file).is_file();
    let path = if custom { file.to_string() } else { builtin(if kind == "alarm" { "alarm" } else { "chime" }) };
    let g = GEN.fetch_add(1, Ordering::SeqCst) + 1;
    if !path.is_empty() {
        sys::play_wav(&path, looped);
    }
    if secs > 0 {
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_secs(secs as u64));
            if GEN.load(Ordering::SeqCst) == g {
                sys::stop_sound();
            }
        });
    }
}

pub fn stop() {
    GEN.fetch_add(1, Ordering::SeqCst);
    sys::stop_sound();
}
