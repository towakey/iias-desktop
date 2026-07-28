use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_notification::NotificationExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // 通知許可をリクエスト
      if let Ok(state) = app.notification().permission_state() {
        println!("notification permission: {:?}", state);
      }

      // トレイアイコンとメニュー
      let show_i = tauri::menu::MenuItem::with_id(app, "show", "表示", true, None::<&str>)?;
      let quit_i = tauri::menu::MenuItem::with_id(app, "quit", "終了", true, None::<&str>)?;
      let menu = tauri::menu::Menu::with_items(app, &[&show_i, &quit_i])?;
      let _tray = tauri::tray::TrayIconBuilder::with_id("main-tray")
        .icon(app.default_window_icon().cloned().expect("default icon"))
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
          "quit" => app.exit(0),
          "show" => {
            if let Some(window) = app.get_webview_window("main") {
              let _ = window.show();
              let _ = window.set_focus();
            }
          }
          _ => {}
        })
        .on_tray_icon_event(|tray, event| {
          if let tauri::tray::TrayIconEvent::Click {
            button: tauri::tray::MouseButton::Left,
            ..
          } = event
          {
            if let Some(window) = tray.app_handle().get_webview_window("main") {
              let _ = window.show();
              let _ = window.set_focus();
            }
          }
        })
        .build(app)?;

      // 起動時にメインウィンドウを作成
      WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("IIAS Desktop")
        .inner_size(960.0, 720.0)
        .resizable(true)
        .devtools(true)
        .build()?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
