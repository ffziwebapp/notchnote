//! Pelacak produktivitas: aplikasi aktif tiap detik -> produktif / netral / gangguan / idle.

use crate::store::{p, read_json, today, write_json};
use crate::sys;
use serde_json::{json, Map, Value};
use std::collections::HashMap;

fn pretty_app(proc_: &str) -> String {
    let stem = proc_.strip_suffix(".exe").unwrap_or(proc_);
    let m: &[(&str, &str)] = &[
        ("code", "VS Code"), ("chrome", "Chrome"), ("msedge", "Edge"), ("firefox", "Firefox"), ("brave", "Brave"), ("opera", "Opera"),
        ("winword", "Word"), ("excel", "Excel"), ("powerpnt", "PowerPoint"), ("explorer", "File Explorer"), ("windowsterminal", "Terminal"),
        ("pycharm64", "PyCharm"), ("idea64", "IntelliJ"), ("devenv", "Visual Studio"), ("spotify", "Spotify"), ("whatsapp", "WhatsApp"),
        ("telegram", "Telegram"), ("discord", "Discord"), ("notepad++", "Notepad++"), ("sublime_text", "Sublime Text"), ("acrobat", "Acrobat"),
        ("cursor", "Cursor"), ("notion", "Notion"), ("obsidian", "Obsidian"), ("figma", "Figma"), ("zoom", "Zoom"), ("ms-teams", "Teams"),
    ];
    if let Some((_, v)) = m.iter().find(|(k, _)| *k == stem) {
        return v.to_string();
    }
    if stem.is_empty() {
        return "Desktop".into();
    }
    let mut c = stem.chars();
    match c.next() {
        Some(f) => f.to_uppercase().collect::<String>() + &c.as_str().to_lowercase(),
        None => "Desktop".into(),
    }
}

fn title_case(s: &str) -> String {
    s.split(' ')
        .map(|w| {
            let mut c = w.chars();
            match c.next() {
                Some(f) => f.to_uppercase().collect::<String>() + &c.as_str().to_lowercase(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

pub struct Tracker {
    pub cfg: Value,
    pub day: String,
    pub data: Value,
    pub cat: String,
    pub label: String,
    pub streak: i64,
    calm: i64,
    week_cache: HashMap<String, Value>,
}

fn blank(d: &str) -> Value {
    json!({"date": d, "productive": 0, "neutral": 0, "distracting": 0, "idle": 0, "pomodoro": 0, "apps": {}})
}

fn load(d: &str) -> Value {
    let mut x = blank(d);
    if let Value::Object(m) = read_json(&p(&["stats", &format!("{}.json", d)]), json!({})) {
        for (k, v) in m {
            x[k] = v;
        }
    }
    if !x["apps"].is_object() {
        x["apps"] = json!({});
    }
    x
}

fn num(v: &Value, k: &str) -> i64 {
    v.get(k).and_then(|x| x.as_i64().or_else(|| x.as_f64().map(|f| f as i64))).unwrap_or(0)
}

impl Tracker {
    pub fn new() -> Self {
        let day = today();
        Tracker { cfg: json!({}), data: load(&day), day, cat: "neutral".into(), label: "-".into(), streak: 0, calm: 0, week_cache: HashMap::new() }
    }

    pub fn save(&self) {
        write_json(&p(&["stats", &format!("{}.json", self.day)]), &self.data);
    }

    pub fn reset(&mut self) {
        self.data = blank(&self.day);
        self.save();
    }

    pub fn add_pomodoro(&mut self) {
        self.data["pomodoro"] = json!(num(&self.data, "pomodoro") + 1);
        self.save();
    }

    fn list(&self, k: &str) -> Vec<String> {
        self.cfg.get(k).and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default()
    }

    fn classify(&self, proc_: &str, title: &str) -> (String, String) {
        let t = title.to_lowercase();
        for k in self.list("distracting_keywords") {
            if !k.is_empty() && t.contains(&k) {
                let lab = k.trim_matches(|c| c == ' ' || c == '/');
                return ("distracting".into(), if lab == "x" { "X".into() } else { title_case(lab) });
            }
        }
        for k in self.list("productive_keywords") {
            if !k.is_empty() && t.contains(&k) {
                return ("productive".into(), title_case(&k));
            }
        }
        if self.list("distracting_apps").iter().any(|a| a == proc_) {
            return ("distracting".into(), pretty_app(proc_));
        }
        if self.list("productive_apps").iter().any(|a| a == proc_) {
            return ("productive".into(), pretty_app(proc_));
        }
        ("neutral".into(), pretty_app(proc_))
    }

    pub fn tick(&mut self) {
        let td = today();
        if td != self.day {
            self.save();
            self.day = td;
            self.data = blank(&self.day);
        }
        let idle_lim = self.cfg.get("idle").and_then(|v| v.as_f64()).unwrap_or(90.0);
        let (cat, label) = if sys::idle_seconds() >= idle_lim {
            ("idle".to_string(), "Idle".to_string())
        } else {
            let (proc_, title, pid) = sys::foreground_info();
            if pid != 0 && pid == std::process::id() {
                if self.cat != "idle" { (self.cat.clone(), self.label.clone()) } else { ("neutral".into(), "Desktop".into()) }
            } else if proc_.is_empty() && title.is_empty() {
                ("neutral".into(), "Desktop".into())
            } else {
                self.classify(&proc_, &title)
            }
        };
        self.data[&cat] = json!(num(&self.data, &cat) + 1);
        if cat != "idle" {
            let apps = self.data["apps"].as_object_mut().unwrap();
            let v = apps.get(&label).and_then(|x| x.as_i64()).unwrap_or(0) + 1;
            apps.insert(label.clone(), json!(v));
        }
        if cat == "distracting" {
            self.streak += 1;
            self.calm = 0;
        } else {
            self.calm += 1;
            if self.calm >= 15 {
                self.streak = 0;
            }
        }
        self.cat = cat;
        self.label = label;
    }

    pub fn track_json(&self) -> String {
        json!({"cat": self.cat, "label": self.label, "streak": self.streak}).to_string()
    }

    fn top_apps(d: &Value, n: usize) -> Vec<Value> {
        let mut v: Vec<(String, i64)> = d
            .get("apps")
            .and_then(|a| a.as_object())
            .map(|m| m.iter().map(|(k, v)| (k.clone(), v.as_i64().unwrap_or(0))).collect())
            .unwrap_or_default();
        v.sort_by(|a, b| b.1.cmp(&a.1));
        v.into_iter().take(n).map(|(k, x)| json!([k, x])).collect()
    }

    pub fn stats_json(&mut self) -> String {
        let mut week = vec![];
        let today_d = chrono::Local::now().date_naive();
        for i in (0..7).rev() {
            let day = (today_d - chrono::Duration::days(i)).format("%Y-%m-%d").to_string();
            let x = if day == self.day {
                self.data.clone()
            } else {
                self.week_cache.entry(day.clone()).or_insert_with(|| read_json(&p(&["stats", &format!("{}.json", day)]), json!({}))).clone()
            };
            week.push(json!({"d": day, "p": num(&x, "productive"), "x": num(&x, "distracting")}));
        }
        let d = &self.data;
        let mut t = Map::new();
        for k in ["productive", "neutral", "distracting", "idle", "pomodoro"] {
            t.insert(k.into(), json!(num(d, k)));
        }
        t.insert("apps".into(), Value::Array(Self::top_apps(d, 6)));
        json!({"today": t, "week": week}).to_string()
    }

    /// Ringkasan produktivitas per hari untuk Logbook (maks. 62 hari)
    pub fn range_json(&self, from: &str, to: &str) -> String {
        use chrono::NaiveDate;
        let (Ok(mut a), Ok(mut b)) = (NaiveDate::parse_from_str(from, "%Y-%m-%d"), NaiveDate::parse_from_str(to, "%Y-%m-%d")) else { return "{}".into() };
        if b < a {
            std::mem::swap(&mut a, &mut b);
        }
        b = b.min(a + chrono::Duration::days(62));
        let mut out = Map::new();
        let mut day = a;
        while day <= b {
            let k = day.format("%Y-%m-%d").to_string();
            let path = p(&["stats", &format!("{}.json", k)]);
            let x = if k == self.day { Some(self.data.clone()) } else if path.exists() { Some(read_json(&path, json!({}))) } else { None };
            if let Some(x) = x {
                let mut o = Map::new();
                for f in ["productive", "neutral", "distracting", "idle", "pomodoro"] {
                    o.insert(f.into(), json!(num(&x, f)));
                }
                o.insert("apps".into(), Value::Array(Self::top_apps(&x, 5)));
                out.insert(k, Value::Object(o));
            }
            day += chrono::Duration::days(1);
        }
        Value::Object(out).to_string()
    }
}
