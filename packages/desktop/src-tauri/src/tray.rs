use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Manager, Runtime, WebviewWindow,
};

const MAIN_WINDOW_LABEL: &str = "main";
const TRAY_ID: &str = "main-tray";
const MENU_SHOW_ID: &str = "tray-show";
const MENU_HIDE_ID: &str = "tray-hide";
const MENU_QUIT_ID: &str = "tray-quit";

#[derive(Default)]
pub struct TrayState {
    quitting: AtomicBool,
}

pub fn init(app: &App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, MENU_SHOW_ID, "Show App", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, MENU_HIDE_ID, "Hide", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, MENU_QUIT_ID, "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &hide, &separator, &quit])?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Claude Code Provider Gateway")
        .on_menu_event(|app, event| match event.id().as_ref() {
            MENU_SHOW_ID => show_main_window(app),
            MENU_HIDE_ID => hide_main_window(app),
            MENU_QUIT_ID => quit_app(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder.build(app)?;
    Ok(())
}

pub fn handle_close_requested<R: Runtime>(
    app: &AppHandle<R>,
    window: &WebviewWindow<R>,
    api: &tauri::CloseRequestApi,
) {
    if is_quitting(app) {
        return;
    }

    api.prevent_close();
    if let Err(err) = window.hide() {
        log::warn!("failed to hide main window on close request: {err}");
    }
}

pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        log::warn!("main window not found while opening from tray");
        return;
    };

    if let Err(err) = window.unminimize() {
        log::warn!("failed to unminimize main window: {err}");
    }
    if let Err(err) = window.show() {
        log::warn!("failed to show main window: {err}");
    }
    if let Err(err) = window.set_focus() {
        log::warn!("failed to focus main window: {err}");
    }
}

pub fn hide_main_window<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        log::warn!("main window not found while hiding from tray");
        return;
    };

    if let Err(err) = window.hide() {
        log::warn!("failed to hide main window: {err}");
    }
}

pub fn is_main_window(label: &str) -> bool {
    label == MAIN_WINDOW_LABEL
}

fn quit_app<R: Runtime>(app: &AppHandle<R>) {
    app.state::<TrayState>()
        .quitting
        .store(true, Ordering::SeqCst);
    app.exit(0);
}

fn is_quitting<R: Runtime>(app: &AppHandle<R>) -> bool {
    app.state::<TrayState>().quitting.load(Ordering::SeqCst)
}
