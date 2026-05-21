use serde_json::{Map, Value};
use std::{fs, path::PathBuf};

#[derive(Debug, Clone, Default)]
pub struct Settings {
    pub settings_type: String,
    pub data: Map<String, Value>,
    pub file_path: PathBuf,
}

impl Settings {
    pub fn new(settings_type: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let user_data = Self::user_data_path();
        let file_name = if settings_type == "app" {
            "settings"
        } else {
            settings_type
        };
        let file_path = user_data
            .join("config")
            .join(format!("{}.json", file_name));

        let data = if file_path.exists() {
            let content = fs::read_to_string(&file_path)?;
            serde_json::from_str::<Map<String, Value>>(&content).unwrap_or_default()
        } else {
            Map::new()
        };

        Ok(Settings {
            settings_type: settings_type.to_string(),
            data,
            file_path,
        })
    }

    pub fn get(&self, key: &str) -> Option<&Value> {
        self.data.get(key)
    }

    pub fn set(&mut self, updates: Map<String, Value>) {
        for (k, v) in updates {
            self.data.insert(k, v);
        }
        self.write_file();
    }

    pub fn all_serialized(&self) -> Value {
        Value::Object(self.data.clone())
    }

    fn write_file(&self) {
        if let Some(parent) = self.file_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string_pretty(&self.data) {
            let _ = fs::write(&self.file_path, json);
        }
    }

    fn user_data_path() -> PathBuf {
        if let Ok(p) = std::env::var("FERDIUM_APPDATA_DIR") {
            return PathBuf::from(p);
        }
        #[cfg(target_os = "linux")]
        {
            let home = std::env::var("HOME").unwrap_or_default();
            let xdg = std::env::var("XDG_CONFIG_HOME")
                .unwrap_or_else(|_| format!("{}/.config", home));
            PathBuf::from(xdg).join("Ferdium")
        }
        #[cfg(target_os = "macos")]
        {
            let home = std::env::var("HOME").unwrap_or_default();
            PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("Ferdium")
        }
        #[cfg(target_os = "windows")]
        {
            let appdata = std::env::var("APPDATA").unwrap_or_default();
            PathBuf::from(appdata).join("Ferdium")
        }
    }
}
