const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const ExtensionUtils = imports.misc.extensionUtils;

const Self = ExtensionUtils.getCurrentExtension();
const SourceRow = Self.imports.ui.sourceRow;
const Settings = Self.imports.settings;
const Utils = Self.imports.utils;
const WallpaperController = Self.imports.wallpaperController;

const LoggerModule = Self.imports.logger;

function init(metaData) {
	//Convenience.initTranslations();
}

// https://gjs.guide/extensions/overview/anatomy.html#prefs-js
// The code in prefs.js will be executed in a separate Gtk process
// Here you will not have access to code running in GNOME Shell, but fatal errors or mistakes will be contained within that process.
// In this process you will be using the Gtk toolkit, not Clutter.

// https://gjs.guide/extensions/development/preferences.html#preferences-window
// Gnome 42+
function fillPreferencesWindow(window) {
	window.set_default_size(-1, 720);
	new RandomWallpaperSettings(window);
}

// 40 < Gnome < 42
// function buildPrefsWidget() {
// 	let window = new Adw.PreferencesWindow();
// 	new RandomWallpaperSettings(window);
// 	return window;
// }

/* UI Setup */
var RandomWallpaperSettings = class {
	constructor(window) {
		this.logger = new LoggerModule.Logger('RWG3', 'RandomWallpaper.Settings');

		this._settings = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA);
		this._backendConnection = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_BACKEND_CONNECTION);
		this._backendConnection.set('pause-timer', 'boolean', true);

		this._sources = [];
		this._loadSources();

		this._builder = new Gtk.Builder();
		//this._builder.set_translation_domain(Self.metadata['gettext-domain']);
		this._builder.add_from_file(Self.path + '/ui/pageGeneral.ui');
		this._builder.add_from_file(Self.path + '/ui/pageSources.ui');

		this._settings.bind('minutes',
			this._builder.get_object('duration_minutes'),
			'value',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('hours',
			this._builder.get_object('duration_hours'),
			'value',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('auto-fetch',
			this._builder.get_object('af_switch'),
			'enable-expansion',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('change-lock-screen',
			this._builder.get_object('change_lock_screen'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('disable-hover-preview',
			this._builder.get_object('disable_hover_preview'),
			'active',
			Gio.SettingsBindFlags.DEFAULT)
		this._settings.bind('hide-panel-icon',
			this._builder.get_object('hide_panel_icon'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('fetch-on-startup',
			this._builder.get_object('fetch_on_startup'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('general-post-command',
			this._builder.get_object('general_post_command'),
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('multiple-displays',
			this._builder.get_object('enable_multiple_displays'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);

		this._bindButtons();
		this._bindHistorySection(window);

		window.connect('close-request', () => {
			this._backendConnection.set('pause-timer', 'boolean', false);
		});

		window.add(this._builder.get_object('page_general'));
		window.add(this._builder.get_object('page_sources'));

		this._sources.forEach(id => {
			let sourceRow = new SourceRow.SourceRow(id);
			this._builder.get_object('sources_list').add(sourceRow);

			sourceRow.button_delete.connect('clicked', () => {
				sourceRow.clearConfig();
				this._builder.get_object('sources_list').remove(sourceRow);
				Utils.Utils.removeItemOnce(this._sources, id);
				this._saveSources();
			});
		});

		try {
			Utils.Utils.getHydraPaperAvailable().then(result => {
				if (result === true) {
					this._builder.get_object('multiple_displays_row').set_sensitive(true);
				}
			});
		} catch (error) {
			// Should already be handled at wallpaperController although in a different context
		}
	}

	}

	_bindButtons() {
		let newWallpaperButton = this._builder.get_object('request_new_wallpaper');
		let origNewWallpaperText = newWallpaperButton.get_child().get_label();
		newWallpaperButton.connect('activated', () => {
			newWallpaperButton.get_child().set_label("Loading ...");
			newWallpaperButton.set_sensitive(false);

			// The backend sets this back to false after fetching the image - listen for that event.
			let handler = this._backendConnection.observe('request-new-wallpaper', () => {
				if (!this._backendConnection.get('request-new-wallpaper', 'boolean')) {
					newWallpaperButton.get_child().set_label(origNewWallpaperText);
					newWallpaperButton.set_sensitive(true);
					this._backendConnection.disconnect(handler);
				}
			});

			this._backendConnection.set('request-new-wallpaper', 'boolean', true);
		});

		let sourceRowList = this._builder.get_object('sources_list');
		this._builder.get_object('button_new_source').connect('clicked', () => {
			let sourceRow = new SourceRow.SourceRow();
			sourceRowList.add(sourceRow);
			this._sources.push(String(sourceRow.id));
			this._saveSources();

			sourceRow.button_delete.connect('clicked', () => {
				sourceRow.clearConfig();
				sourceRowList.remove(sourceRow);
				Utils.Utils.removeItemOnce(this._sources, sourceRow.id);
				this._saveSources();
			});
		});
	}

	_bindHistorySection(window) {
		let entryRow = this._builder.get_object('row_favorites_folder');
		entryRow.text = this._settings.get('favorites-folder', 'string');

		this._settings.bind('history-length',
			this._builder.get_object('history_length'),
			'value',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('favorites-folder',
			entryRow,
			'text',
			Gio.SettingsBindFlags.DEFAULT);

		this._builder.get_object('clear_history').connect('clicked', () => {
			this._backendConnection.set('clear-history', 'boolean', true);
		});

		this._builder.get_object('open_wallpaper_folder').connect('clicked', () => {
			this._backendConnection.set('open-folder', 'boolean', true);
		});

		this._builder.get_object('button_favorites_folder').connect('clicked', () => {
			// For GTK 4.10+
			// Gtk.FileDialog();

			// https://stackoverflow.com/a/54487948
			this._saveDialog = new Gtk.FileChooserNative({
				title: 'Choose a Wallpaper Folder',
				action: Gtk.FileChooserAction.SELECT_FOLDER,
				accept_label: 'Open',
				cancel_label: 'Cancel',
				transient_for: window,
				modal: true,
			});

			this._saveDialog.connect('response', (dialog, response_id) => {
				if (response_id === Gtk.ResponseType.ACCEPT) {
					entryRow.text = this._saveDialog.get_file().get_path();
				}
				this._saveDialog.destroy();
			});

			this._saveDialog.show();
		});
	}

	/**
	 * Load the config from the gschema
	 */
	_loadSources() {
		this._sources = this._settings.get('sources', 'strv');

		// this._sources.sort((a, b) => {
		// 	let path1 = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${a}/`;
		// 	let settingsGeneral1 = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path1);
		// 	let path2 = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${b}/`;
		// 	let settingsGeneral2 = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path2);

		// 	const nameA = settingsGeneral1.get('name', 'string').toUpperCase();
		// 	const nameB = settingsGeneral2.get('name', 'string').toUpperCase();

		// 	return nameA.localeCompare(nameB);
		// });

		this._sources.sort((a, b) => {
			let path1 = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${a}/`;
			let settingsGeneral1 = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path1);
			let path2 = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${b}/`;
			let settingsGeneral2 = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path2);
			return settingsGeneral1.get('type', 'enum') - settingsGeneral2.get('type', 'enum');
		});
	}

	_saveSources() {
		this._settings.set('sources', 'strv', this._sources);
	}
};
