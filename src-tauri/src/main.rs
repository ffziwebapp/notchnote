// Jangan tampilkan jendela konsol di Windows (rilis)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    notchnote_lib::run()
}
