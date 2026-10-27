//! Chat AI dengan streaming: Claude, OpenAI/Groq/OpenRouter/Ollama (format OpenAI), dan Gemini.

use crate::lyrics::Emit;
use crate::store::{http_agent, log};
use serde_json::{json, Value};
use std::io::{BufRead, BufReader};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

fn err_msg(code: u16) -> String {
    match code {
        401 => "API key tidak valid. Periksa lagi di Pengaturan → AI.".into(),
        403 => "Akses ditolak. Pastikan API key punya izin untuk model ini.".into(),
        404 => "Model tidak ditemukan. Ganti nama model di Pengaturan → AI.".into(),
        429 => "Batas pemakaian atau kuota habis. Coba lagi nanti atau cek saldo akun.".into(),
        500 => "Server AI sedang bermasalah. Coba lagi sebentar lagi.".into(),
        529 => "Server AI sedang sibuk. Coba lagi sebentar lagi.".into(),
        c => format!("Permintaan gagal (kode {}).", c),
    }
}

fn cut(s: &str, n: usize) -> String {
    s.chars().take(n).collect()
}

#[allow(clippy::too_many_arguments)]
pub fn stream(emit: Emit, rid: String, provider: String, model: String, key: String, messages: Value, system: String, cancel: Arc<AtomicBool>, workspace: String, ollama: String) {
    let send = |kind: &str, text: &str| emit("ai", json!({"id": rid, "type": kind, "text": text}).to_string());
    let compat = ["openai", "groq", "openrouter", "ollama"].contains(&provider.as_str());

    // gabungkan pesan berurutan dengan peran sama, mulai dari pesan pengguna
    let mut msgs: Vec<(String, String)> = vec![];
    for m in messages.as_array().cloned().unwrap_or_default() {
        let role = if m.get("role").and_then(|x| x.as_str()) == Some("assistant") { "assistant" } else { "user" };
        let txt = m.get("content").and_then(|x| x.as_str()).unwrap_or("").to_string();
        if txt.is_empty() {
            continue;
        }
        match msgs.last_mut() {
            Some(last) if last.0 == role => {
                last.1.push_str("\n\n");
                last.1.push_str(&txt);
            }
            _ => msgs.push((role.into(), txt)),
        }
    }
    while msgs.first().map(|m| m.0 != "user").unwrap_or(false) {
        msgs.remove(0);
    }
    if msgs.is_empty() {
        send("error", "Pesan kosong.");
        return;
    }
    let as_json = |m: &(String, String)| json!({"role": m.0, "content": m.1});
    let (url, body, mut headers): (String, Value, Vec<(String, String)>) = if provider == "claude" {
        let mut b = json!({"model": if model.is_empty() { "claude-haiku-5-5" } else { &model }, "max_tokens": 2048, "stream": true,
                           "messages": msgs.iter().map(as_json).collect::<Vec<_>>()});
        if !system.is_empty() {
            b["system"] = json!(system);
        }
        let mut h = vec![("x-api-key".into(), key.clone()), ("anthropic-version".into(), "2023-06-01".into())];
        if !workspace.is_empty() {
            h.push(("anthropic-workspace-id".into(), workspace.clone()));
        }
        ("https://api.anthropic.com/v1/messages".into(), b, h)
    } else if compat {
        let url = match provider.as_str() {
            "openai" => "https://api.openai.com/v1/chat/completions".to_string(),
            "groq" => "https://api.groq.com/openai/v1/chat/completions".to_string(),
            "openrouter" => "https://openrouter.ai/api/v1/chat/completions".to_string(),
            _ => format!("{}/v1/chat/completions", (if ollama.is_empty() { "http://localhost:11434" } else { &ollama }).trim_end_matches('/')),
        };
        let dm = match provider.as_str() { "openai" => "gpt-5-mini", "groq" => "openai/gpt-oss-120b", "openrouter" => "openrouter/free", _ => "llama3.2" };
        let mut all = vec![];
        if !system.is_empty() {
            all.push(json!({"role": "system", "content": system}));
        }
        all.extend(msgs.iter().map(as_json));
        let mut h = vec![];
        if !key.is_empty() {
            h.push(("Authorization".into(), format!("Bearer {}", key)));
        }
        if provider == "openrouter" {
            h.push(("HTTP-Referer".into(), "https://github.com/ffziwebapp/notchnote".into()));
            h.push(("X-Title".into(), "NotchNote".into()));
        }
        (url, json!({"model": if model.is_empty() { dm } else { &model }, "stream": true, "messages": all}), h)
    } else {
        let m = if model.is_empty() { "gemini-3.5-flash-lite".to_string() } else { model.clone() };
        let mut b = json!({"contents": msgs.iter().map(|x| json!({"role": if x.0 == "assistant" { "model" } else { "user" }, "parts": [{"text": x.1}]})).collect::<Vec<_>>()});
        if !system.is_empty() {
            b["systemInstruction"] = json!({"parts": [{"text": system}]});
        }
        (format!("https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?alt=sse", urlencoding::encode(&m)), b,
         vec![("x-goog-api-key".into(), key.clone())])
    };
    headers.push(("content-type".into(), "application/json".into()));
    headers.push(("Accept".into(), "text/event-stream".into()));
    let mut req = http_agent().post(&url);
    for (k, v) in &headers {
        req = req.set(k, v);
    }
    match req.send_string(&body.to_string()) {
        Ok(resp) => {
            let mut got = false;
            for line in BufReader::new(resp.into_reader()).lines() {
                if cancel.load(Ordering::Relaxed) {
                    send("done", "");
                    return;
                }
                let Ok(line) = line else { break };
                let line = line.trim();
                let Some(data) = line.strip_prefix("data:") else { continue };
                let data = data.trim();
                if data == "[DONE]" {
                    break;
                }
                let Ok(ev) = serde_json::from_str::<Value>(data) else { continue };
                let mut text = String::new();
                if provider == "claude" {
                    match ev.get("type").and_then(|x| x.as_str()) {
                        Some("content_block_delta") => text = ev["delta"]["text"].as_str().unwrap_or("").to_string(),
                        Some("error") => {
                            send("error", ev["error"]["message"].as_str().unwrap_or("Terjadi kesalahan"));
                            return;
                        }
                        _ => {}
                    }
                } else if compat {
                    if let Some(e) = ev.get("error").filter(|e| !e.is_null()) {
                        let m = e.get("message").and_then(|x| x.as_str()).map(String::from).unwrap_or_else(|| e.to_string());
                        send("error", if m.is_empty() { "Terjadi kesalahan" } else { &m });
                        return;
                    }
                    text = ev["choices"][0]["delta"]["content"].as_str().unwrap_or("").to_string();
                } else {
                    for cand in ev["candidates"].as_array().cloned().unwrap_or_default() {
                        for part in cand["content"]["parts"].as_array().cloned().unwrap_or_default() {
                            if !part.get("thought").and_then(|x| x.as_bool()).unwrap_or(false) {
                                text.push_str(part["text"].as_str().unwrap_or(""));
                            }
                        }
                    }
                }
                if !text.is_empty() {
                    got = true;
                    send("chunk", &text);
                }
            }
            send("done", "");
            if !got {
                log(format!("ai empty {} {}", provider, model));
            }
        }
        Err(ureq::Error::Status(code, resp)) => {
            let raw = resp.into_string().unwrap_or_default();
            let detail = serde_json::from_str::<Value>(&raw)
                .ok()
                .and_then(|j| {
                    j.get("error")
                        .and_then(|e| e.get("message").and_then(|m| m.as_str()).map(String::from).or_else(|| e.as_str().map(String::from)))
                        .or_else(|| j.get("message").and_then(|m| m.as_str()).map(String::from))
                })
                .unwrap_or_default();
            let mut msg = err_msg(code);
            if code == 400 && !detail.is_empty() {
                msg = format!("Permintaan ditolak: {}", cut(&detail, 160));
            } else if !detail.is_empty() && [403, 404, 429].contains(&code) {
                msg = format!("{} ({})", msg, cut(&detail, 120));
            }
            send("error", &msg);
        }
        Err(e) => {
            log(format!("ai net {}", e));
            if provider == "ollama" {
                send("error", &format!("Ollama belum berjalan. Buka aplikasi Ollama, pastikan modelnya sudah diunduh (ollama pull {}), lalu coba lagi.",
                    if model.is_empty() { "llama3.2" } else { &model }));
            } else {
                send("error", "Tidak bisa terhubung ke server AI. Periksa koneksi internet.");
            }
        }
    }
}
