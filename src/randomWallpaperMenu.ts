import * as Gio from 'gi://Gio';
import * as GLib from 'gi://GLib';

import * as Main from '@gi/ui/main';
import * as PanelMenu from '@gi/ui/panelMenu';
import * as PopupMenu from '@gi/ui/popupMenu';
import * as ExtensionUtils from '@gi/misc/extensionUtils';

import * as CustomElements from './historyMenuElements.js';
import * as Settings from './settings.js';
import * as Utils from './utils.js';

import {Logger} from './logger.js';
import {WallpaperController} from './wallpaperController.js';

const Self = ExtensionUtils.getCurrentExtension();

class RandomWallpaperMenu {
    private _logger = new Logger('RWG3', 'RandomWallpaperEntry');
    private _settings = new Settings.Settings();
    private _backendConnection = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_BACKEND_CONNECTION);

    private _wallpaperController;
    private _currentBackgroundSection;
    private _historySection;
    private _hidePanelIconHandler;

    private panelMenu;

    constructor(wallpaperController: WallpaperController) {
        this._wallpaperController = wallpaperController;

        this.panelMenu = new PanelMenu.Button(0, 'Random wallpaper');

        // PanelMenu Icon
        const statusIcon = new CustomElements.StatusElement();
        this.panelMenu.add_child(statusIcon.icon);
        this._hidePanelIconHandler = this._settings.observe('hide-panel-icon', this.updatePanelMenuVisibility.bind(this));

        // new wallpaper button
        const newWallpaperItem = new CustomElements.NewWallpaperElement({});
        this.panelMenu.menu.addMenuItem(newWallpaperItem);

        this.panelMenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Set fixed width so the preview images don't widen the menu
        this.panelMenu.menu.actor.set_width(350);

        // current background section
        this._currentBackgroundSection = new PopupMenu.PopupMenuSection();
        this.panelMenu.menu.addMenuItem(this._currentBackgroundSection);
        this.panelMenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // history section
        this._historySection = new CustomElements.HistorySection();
        this.panelMenu.menu.addMenuItem(this._historySection);

        this.panelMenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Temporarily pause timer
        const pauseTimerItem = new PopupMenu.PopupSwitchMenuItem('Pause timer', false);
        pauseTimerItem.sensitive = this._settings.getBoolean('auto-fetch');
        pauseTimerItem.setToggleState(this._backendConnection.getBoolean('pause-timer'));

        pauseTimerItem.connect('toggled', (_, state: boolean) => {
            this._backendConnection.setBoolean('pause-timer', state);
        });

        this._settings.observe('auto-fetch', () => {
            pauseTimerItem.sensitive = this._settings.getBoolean('auto-fetch');
        });

        this._backendConnection.observe('pause-timer', () => {
            pauseTimerItem.setToggleState(this._backendConnection.getBoolean('pause-timer'));
        });

        this.panelMenu.menu.addMenuItem(pauseTimerItem);

        // clear history button
        const clearHistoryItem = new PopupMenu.PopupMenuItem('Clear History');
        this.panelMenu.menu.addMenuItem(clearHistoryItem);

        // open wallpaper folder button
        const openFolder = new PopupMenu.PopupMenuItem('Open Wallpaper Folder');
        this.panelMenu.menu.addMenuItem(openFolder);

        // settings button
        const openSettings = new PopupMenu.PopupMenuItem('Settings');
        this.panelMenu.menu.addMenuItem(openSettings);

        // add eventlistener
        this._wallpaperController.registerStartLoadingHook(() => statusIcon.startLoading());
        this._wallpaperController.registerStopLoadingHook(() => statusIcon.stopLoading());
        this._wallpaperController.registerStopLoadingHook(() => this.setHistoryList());

        // new wallpaper event
        newWallpaperItem.connect('activate', () => {
            this._wallpaperController.fetchNewWallpaper().catch(logError);
        });

        // clear history event
        clearHistoryItem.connect('activate', () => {
            this._wallpaperController.deleteHistory();
        });

        // Open Wallpaper Folder
        openFolder.connect('activate', () => {
            const uri = GLib.filename_to_uri(this._wallpaperController.wallpaperLocation, '');
            Utils.execCheck(['xdg-open', uri]).catch(logError);
        });

        openSettings.connect('activate', () => {
            // FIXME: Unhandled promise rejection. To suppress this warning, add an error handler to your promise chain with .catch() or a try-catch block around your await expression.
            Gio.DBus.session.call(
                'org.gnome.Shell.Extensions',
                '/org/gnome/Shell/Extensions',
                'org.gnome.Shell.Extensions',
                'OpenExtensionPrefs',
                new GLib.Variant('(ssa{sv})', [Self.uuid, '', {}]),
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null);
        });

        this.panelMenu.menu.actor.connect('show', () => {
            newWallpaperItem.show();
        });

        // when the popupMenu disappears, check if the wallpaper is the original and
        // reset it if needed
        this.panelMenu.menu.actor.connect('hide', () => {
            this._wallpaperController.resetWallpaper();
        });

        this.panelMenu.menu.actor.connect('leave-event', () => {
            this._wallpaperController.resetWallpaper();
        });

        this._settings.observe('history', this.setHistoryList.bind(this));
    }

    init() {
        this.updatePanelMenuVisibility();
        this.setHistoryList();

        // add to panel
        Main.panel.addToStatusArea('random-wallpaper-menu', this.panelMenu);
    }

    cleanup() {
        this.clearHistoryList();
        this.panelMenu.destroy();

        // remove all signal handlers
        if (this._hidePanelIconHandler !== null)
            this._settings.disconnect(this._hidePanelIconHandler);
    }

    updatePanelMenuVisibility() {
        if (this._settings.getBoolean('hide-panel-icon'))
            this.panelMenu.hide();
        else
            this.panelMenu.show();
    }

    setCurrentBackgroundElement() {
        this._currentBackgroundSection.removeAll();

        const historyController = this._wallpaperController.getHistoryController();
        const history = historyController.history;

        if (history.length > 0) {
            const currentImage = new CustomElements.CurrentImageElement(undefined, history[0]);
            this._currentBackgroundSection.addMenuItem(currentImage);
        }
    }

    setHistoryList() {
        this._wallpaperController.update();
        this.setCurrentBackgroundElement();

        const historyController = this._wallpaperController.getHistoryController();
        const history = historyController.history;

        if (history.length <= 1) {
            this.clearHistoryList();
            return;
        }

        /**
         * @this {RandomWallpaperMenu} RandomWallpaperMenu
         * @param {CustomElements.HistoryElement} actor The activating panel item
         */
        // eslint-disable-next-line no-unused-vars
        function onLeave(this: RandomWallpaperMenu, actor: typeof CustomElements.HistoryElement) {
            this._wallpaperController.resetWallpaper();
        }

        /**
         * @this {RandomWallpaperMenu} RandomWallpaperMenu
         * @param {CustomElements.HistoryElement} actor The activating panel item
         */
        function onEnter(this: RandomWallpaperMenu, actor: typeof CustomElements.HistoryElement) {
            // @ts-expect-error Typing fails for GObject.registerClass
            this._wallpaperController.previewWallpaper(actor.historyEntry.id);
        }

        /**
         * @this {RandomWallpaperMenu} RandomWallpaperMenu
         * @param {CustomElements.HistoryElement} actor The activating panel item
         */
        function onSelect(this: RandomWallpaperMenu, actor: typeof CustomElements.HistoryElement) {
            // @ts-expect-error Typing fails for GObject.registerClass
            this._wallpaperController.setWallpaper(actor.historyEntry.id);
        }

        this._historySection.updateList(history, onEnter.bind(this), onLeave.bind(this), onSelect.bind(this));
    }

    clearHistoryList() {
        this._historySection.clear();
    }
}

export {RandomWallpaperMenu};