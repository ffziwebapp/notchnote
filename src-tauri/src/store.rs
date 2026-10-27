//! Penyimpanan data di %APPDATA%\NotchNote (sama dengan versi Python, jadi data lama langsung terbaca).

use serde_json::Value;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::OnceLock;

pub const APP: &str = "NotchNote";
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

pub fn ua() -> String {
    format!("NotchNote/{} (Windows desktop notch)", VERSION)
}

static DIR: OnceLock<PathBuf> = OnceLock::new();

pub fn data_dir() -> &'static PathBuf {
    DIR.get_or_init(|| {
        let base = std::env::var_os("APPDATA")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local").join("share")))
            .unwrap_or_else(|| PathBuf::from("."));
        let d = base.join(APP);
        for sub in ["", "stats", "clips", "art", "lyrics", "sounds"] {
            let _ = fs::create_dir_all(d.join(sub));
        }
        d
    })
}

/// Path di dalam folder data.
pub fn p(parts: &[&str]) -> PathBuf {
    let mut x = data_dir().clone();
    for s in parts {
        x.push(s);
    }
    x
}

pub fn log(msg: impl AsRef<str>) {
    let line = format!("{} {}\n", chrono::Local::now().format("%Y-%m-%d %H:%M:%S"), msg.as_ref());
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(p(&["notchnote.log"])) {
        let _ = f.write_all(line.as_bytes());
    }
}

pub fn read_json(path: &PathBuf, default: Value) -> Value {
    match fs::read(path) {
        Ok(b) => {
            let b = b.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(&b);
            serde_json::from_slice(b).unwrap_or(default)
        }
        Err(_) => default,
    }
}

pub fn write_json(path: &PathBuf, data: &Value) -> bool {
    let tmp = path.with_extension("json.tmp");
    let res = (|| -> std::io::Result<()> {
        let s = serde_json::to_string_pretty(data).unwrap_or_else(|_| "null".into());
        fs::write(&tmp, s.as_bytes())?;
        fs::rename(&tmp, path)?;
        Ok(())
    })();
    if let Err(e) = res {
        log(format!("write_json {:?} {}", path, e));
        return false;
    }
    true
}

pub fn today() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn now_s() -> f64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0)
}

pub fn uid(n: usize) -> String {
    use rand::Rng;
    const C: &[u8] = b"0123456789abcdef";
    let mut r = rand::thread_rng();
    (0..n).map(|_| C[r.gen_range(0..16)] as char).collect()
}

/// Alamat file lokal yang bisa dibuka antarmuka (protokol aset Tauri).
pub fn asset_url(path: &PathBuf) -> String {
    let s = path.to_string_lossy();
    if cfg!(windows) {
        format!("http://asset.localhost/{}", urlencoding::encode(&s))
    } else {
        format!("asset://localhost/{}", urlencoding::encode(&s))
    }
}

/// Ambil nilai bertingkat dari JSON: get(&cfg, &["theme", "scale"])
pub fn jget<'a>(v: &'a Value, path: &[&str]) -> Option<&'a Value> {
    let mut cur = v;
    for k in path {
        cur = cur.get(*k)?;
    }
    Some(cur)
}

pub fn jbool(v: &Value, path: &[&str], def: bool) -> bool {
    jget(v, path).and_then(|x| x.as_bool()).unwrap_or(def)
}

pub fn jf64(v: &Value, path: &[&str], def: f64) -> f64 {
    jget(v, path).and_then(|x| x.as_f64()).unwrap_or(def)
}

pub fn jstr(v: &Value, path: &[&str]) -> String {
    jget(v, path).and_then(|x| x.as_str()).unwrap_or("").to_string()
}

pub fn sha1_hex(b: &[u8]) -> String {
    sha1_smol::Sha1::from(b).digest().to_string()
}

pub fn http_agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(std::time::Duration::from_secs(15))
        .timeout_read(std::time::Duration::from_secs(60))
        .user_agent(&ua())
        .build()
}

pub fn http_json(url: &str, secs: u64) -> Result<Value, String> {
    let r = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(secs))
        .user_agent(&ua())
        .build()
        .get(url)
        .call();
    match r {
        Ok(resp) => resp.into_json::<Value>().map_err(|e| e.to_string()),
        Err(ureq::Error::Status(code, _)) => Err(format!("HTTP {}", code)),
        Err(e) => Err(e.to_string()),
    }
}
