//! Klip: riwayat screenshot & teks yang disalin.

use crate::store::{asset_url, jbool, jf64, log, now_ms, p, read_json, sha1_hex, uid, write_json};
use serde_json::{json, Value};
use std::borrow::Cow;

pub struct Clips {
    pub items: Vec<Value>,
    pub ignore: Option<String>,
}

fn file_of(c: &Value, k: &str) -> String {
    c.get(k).and_then(|x| x.as_str()).unwrap_or("").to_string()
}

pub enum Captured {
    None,
    Changed,
    NewImage(Value),
}

impl Clips {
    pub fn load() -> Self {
        let items = read_json(&p(&["clips", "index.json"]), json!([])).as_array().cloned().unwrap_or_default();
        let items = items
            .into_iter()
            .filter(|c| c.get("type").and_then(|x| x.as_str()) == Some("text") || p(&["clips", &file_of(c, "file")]).is_file())
            .collect();
        Clips { items, ignore: None }
    }

    pub fn public(&self) -> Value {
        Value::Array(
            self.items
                .iter()
                .map(|c| {
                    let mut d = json!({});
                    for k in ["id", "type", "text", "ts", "pinned", "w", "h"] {
                        d[k] = c.get(k).cloned().unwrap_or(Value::Null);
                    }
                    if c["type"] == "image" {
                        let f = file_of(c, "file");
                        let t = file_of(c, "thumb");
                        d["url"] = json!(asset_url(&p(&["clips", &f])));
                        d["thumb"] = json!(asset_url(&p(&["clips", if t.is_empty() { &f } else { &t }])));
                    }
                    d
                })
                .collect(),
        )
    }

    pub fn persist(&self) {
        write_json(&p(&["clips", "index.json"]), &Value::Array(self.items.clone()));
    }

    fn remove_files(c: &Value) {
        for k in ["file", "thumb"] {
            let f = file_of(c, k);
            if !f.is_empty() {
                let _ = std::fs::remove_file(p(&["clips", &f]));
            }
        }
    }

    fn trim(&mut self, max: usize) {
        self.items.sort_by_key(|c| -c.get("ts").and_then(|x| x.as_i64()).unwrap_or(0));
        let mut keep = vec![];
        let mut unpinned = 0;
        for c in self.items.drain(..) {
            let pinned = c.get("pinned").and_then(|x| x.as_bool()).unwrap_or(false);
            if pinned || unpinned < max {
                if !pinned {
                    unpinned += 1;
                }
                keep.push(c);
            } else {
                Self::remove_files(&c);
            }
        }
        self.items = keep;
    }

    fn find(&mut self, id: &str) -> Option<usize> {
        self.items.iter().position(|c| c["id"] == id)
    }

    /// Baca clipboard dan simpan isinya kalau baru. cfg = bagian "clip" dari config.
    pub fn capture(&mut self, cfg: &Value) -> Captured {
        if crate::sys::clipboard_excluded() {
            return Captured::None;
        }
        let Ok(mut cb) = arboard::Clipboard::new() else { return Captured::None };
        let max = jf64(cfg, &["max"], 40.0).max(1.0) as usize;
        let text = cb.get_text().ok().filter(|t| !t.trim().is_empty());
        if text.is_none() {
            let Ok(img) = cb.get_image() else { return Captured::None };
            let (w, h) = (img.width as u32, img.height as u32);
            let Some(rgba) = image::RgbaImage::from_raw(w, h, img.bytes.into_owned()) else { return Captured::None };
            let mut png = Vec::new();
            if image::DynamicImage::ImageRgba8(rgba.clone()).write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png).is_err() {
                return Captured::None;
            }
            // hash dari piksel (stabil walau encoder berbeda)
            let hsh = sha1_hex(rgba.as_raw());
            if self.ignore.as_deref() == Some(&hsh) {
                self.ignore = None;
                return Captured::None;
            }
            if let Some(i) = self.items.iter().position(|c| c.get("hash").and_then(|x| x.as_str()) == Some(&hsh)) {
                self.items[i]["ts"] = json!(now_ms());
                self.persist();
                return Captured::Changed;
            }
            let id = uid(12);
            let name = format!("{}-{}", chrono::Local::now().format("%Y%m%d-%H%M%S"), &id[..4]);
            if std::fs::write(p(&["clips", &format!("{}.png", name)]), &png).is_err() {
                return Captured::None;
            }
            let tw = w.min(420);
            let th = ((h as f64) * tw as f64 / w.max(1) as f64).round().max(1.0) as u32;
            let thumb = image::imageops::resize(&rgba, tw, th, image::imageops::FilterType::Triangle);
            let rgb = image::DynamicImage::ImageRgba8(thumb).to_rgb8();
            if let Ok(f) = std::fs::File::create(p(&["clips", &format!("{}_t.jpg", name)])) {
                let mut enc = image::codecs::jpeg::JpegEncoder::new_with_quality(std::io::BufWriter::new(f), 82);
                if let Err(e) = enc.encode_image(&rgb) {
                    log(format!("thumb {}", e));
                }
            }
            let item = json!({"id": id, "type": "image", "file": format!("{}.png", name), "thumb": format!("{}_t.jpg", name), "hash": hsh,
                              "ts": now_ms(), "pinned": false, "w": w, "h": h});
            self.items.insert(0, item);
            self.trim(max);
            self.persist();
            let pub_ = self.public().as_array().and_then(|a| a.iter().find(|x| x["id"] == id).cloned());
            return pub_.map(Captured::NewImage).unwrap_or(Captured::Changed);
        }
        if !jbool(cfg, &["text"], true) {
            return Captured::None;
        }
        let mut text = text.unwrap();
        if text.chars().count() > 20000 {
            text = text.chars().take(20000).collect();
        }
        let hsh = sha1_hex(text.as_bytes());
        if self.ignore.as_deref() == Some(&hsh) {
            self.ignore = None;
            return Captured::None;
        }
        if let Some(i) = self.items.iter().position(|c| c.get("hash").and_then(|x| x.as_str()) == Some(&hsh)) {
            let mut c = self.items.remove(i);
            c["ts"] = json!(now_ms());
            self.items.insert(0, c);
            self.persist();
            return Captured::Changed;
        }
        self.items.insert(0, json!({"id": uid(12), "type": "text", "text": text, "hash": hsh, "ts": now_ms(), "pinned": false}));
        self.trim(max);
        self.persist();
        Captured::Changed
    }

    pub fn copy_text(&mut self, text: &str) {
        self.ignore = Some(sha1_hex(text.as_bytes()));
        if let Ok(mut cb) = arboard::Clipboard::new() {
            let _ = cb.set_text(text.to_string());
        }
    }

    pub fn copy(&mut self, id: &str) {
        let Some(i) = self.find(id) else { return };
        let c = self.items[i].clone();
        let Ok(mut cb) = arboard::Clipboard::new() else { return };
        if c["type"] == "image" {
            if let Ok(img) = image::open(p(&["clips", &file_of(&c, "file")])) {
                let rgba = img.to_rgba8();
                self.ignore = Some(sha1_hex(rgba.as_raw()));
                let _ = cb.set_image(arboard::ImageData { width: rgba.width() as usize, height: rgba.height() as usize, bytes: Cow::Owned(rgba.into_raw()) });
            }
        } else {
            let t = file_of(&c, "text");
            self.ignore = Some(sha1_hex(t.as_bytes()));
            let _ = cb.set_text(t);
        }
    }

    pub fn delete(&mut self, id: &str) {
        if let Some(i) = self.find(id) {
            let c = self.items.remove(i);
            Self::remove_files(&c);
            self.persist();
        }
    }

    pub fn pin(&mut self, id: &str, on: bool) {
        if let Some(i) = self.find(id) {
            self.items[i]["pinned"] = json!(on);
            self.persist();
        }
    }

    pub fn clear(&mut self) {
        let (keep, drop): (Vec<Value>, Vec<Value>) = self.items.drain(..).partition(|c| c.get("pinned").and_then(|x| x.as_bool()).unwrap_or(false));
        for c in &drop {
            Self::remove_files(c);
        }
        self.items = keep;
        self.persist();
    }

    pub fn image_path(&mut self, id: &str) -> Option<std::path::PathBuf> {
        let i = self.find(id)?;
        let c = &self.items[i];
        if c["type"] != "image" {
            return None;
        }
        Some(p(&["clips", &file_of(c, "file")]))
    }
}
