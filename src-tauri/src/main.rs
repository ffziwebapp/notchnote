// Jangan tampilkan jendela konsol di Windows (rilis)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if notchnote_lib::guard_main() {
        return;
    }
    notchnote_lib::run()
}
