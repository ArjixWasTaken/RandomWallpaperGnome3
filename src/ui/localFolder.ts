const Adw = imports.gi.Adw;
const ExtensionUtils = imports.misc.extensionUtils;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const Self = ExtensionUtils.getCurrentExtension();
const Settings = Self.imports.settings;

var LocalFolderSettingsGroup = GObject.registerClass({
	GTypeName: 'LocalFolderSettingsGroup',
	Template: GLib.filename_to_uri(Self.path + '/ui/localFolder.ui', null),
	InternalChildren: [
		'folder',
		'folder_row'
	]
}, class LocalFolderSettingsGroup extends Adw.PreferencesGroup {
	_saveDialog = null;

	constructor(id, params = {}) {
		super(params);

		const path = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/localFolder/${id}/`;
		this._settings = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_LOCAL_FOLDER, path);

		this._settings.bind('folder',
			this._folder_row,
			'text',
			Gio.SettingsBindFlags.DEFAULT);

		this._folder.connect('clicked', () => {
			// For GTK 4.10+
			// Gtk.FileDialog();

			// https://stackoverflow.com/a/54487948
			this._saveDialog = new Gtk.FileChooserNative({
				title: 'Choose a Wallpaper Folder',
				action: Gtk.FileChooserAction.SELECT_FOLDER,
				accept_label: 'Open',
				cancel_label: 'Cancel',
				transient_for: this.get_root(),
				modal: true,
			});

			this._saveDialog.connect('response', (dialog, response_id) => {
				if (response_id === Gtk.ResponseType.ACCEPT) {
					this._folder_row.text = this._saveDialog.get_file().get_path();
				}
				this._saveDialog.destroy();
			});

			this._saveDialog.show();
		});
	}

	clearConfig() {
		this._settings.reset('folder');
	}
});