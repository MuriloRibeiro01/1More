// Correções de build Android que precisam sobreviver a `expo prebuild --clean`.
// 1) WatermelonDB 0.28 usa BuildConfig.DEBUG no Java, mas o AGP 9 não gera BuildConfig
//    em módulos de biblioteca por padrão: liga buildConfig só para o módulo do Watermelon.
// 2) O Ninja do CMake 3.22.1 não suporta caminhos > 260 caracteres no Windows
//    ("Filename longer than 260 characters"): fixa um CMake mais novo (Ninja 1.12+).
const { withProjectBuildGradle, withAppBuildGradle } = require('expo/config-plugins');

const CMAKE_VERSION = '3.31.6';
const MARK_ROOT = '// withWatermelonBuildConfig';
const MARK_APP = '// withCmakeVersion';

const ROOT_BLOCK = `
${MARK_ROOT}
subprojects { sub ->
  if (sub.name == 'nozbe_watermelondb') {
    sub.pluginManager.withPlugin('com.android.library') {
      sub.android.buildFeatures.buildConfig = true
    }
  }
}
`;

const APP_BLOCK = `
${MARK_APP}
android {
  externalNativeBuild {
    cmake {
      version = "${CMAKE_VERSION}"
    }
  }
}
`;

module.exports = function withWatermelonBuildConfig(config) {
  config = withProjectBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARK_ROOT)) cfg.modResults.contents += ROOT_BLOCK;
    return cfg;
  });
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARK_APP)) cfg.modResults.contents += APP_BLOCK;
    return cfg;
  });
};
