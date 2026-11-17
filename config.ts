import type { ExtensionConfig } from '@any-listen/extension-kit/config'

import pkg from './package.json' with { type: 'json' }

const config: ExtensionConfig = {
  id: 'lx-api-source-downloader',
  name: 'LX Music API Source Downloader',
  description: '{description}',
  version: pkg.version,
  homepage: pkg.homepage,
  license: pkg.license,
  author: pkg.author,
  target_engine: '1.4.0',
  categories: [],
  tags: [],
  download_url_template: 'https://github.com/any-listen/any-listen-extension-lx-api-source-loader/releases/download/v{version}',
  icon: './resources/icon.png',
  grant: ['internet', 'isolate_context'],
  contributes: {
    settings: [
      {
        field: 'enabledCache',
        name: '{settings.enabledCache}',
        description: '{settings.enabledCacheDescription}',
        type: 'boolean',
        default: false,
      },
      {
        field: 'enabledSourceLogout',
        name: '{settings.enabledSourceLogout}',
        description: '{settings.enabledSourceLogoutDescription}',
        type: 'boolean',
        default: false,
      },
      {
        field: 'enabledScripts',
        name: '{settings.scriptSources}',
        description: '{settings.scriptSourcesDescription}',
        type: 'configCheckboxMultiple',
        max: 3,
        enumConfigFiled: 'importedScriptSources',
        enumFiled: 'id',
        enumNameFiled: 'name',
        enumDescriptionFiled: 'fileDesc',
        removeable: true,
        actionCommands: ['addLocalSource', 'addRemoteSource', 'exportSources'],
        actionCommandNames: ['{settings.addLocalSource}', '{settings.addRemoteSource}', '{command.exportSourcesName}'],
      },
      {
        field: 'apiBase',
        name: '{settings.apiBase}',
        description: '{settings.apiBaseDescription}',
        type: 'input',
        default: 'https://music-api.gdstudio.xyz/api.php',
      },
      {
        field: 'searchSource',
        name: '{settings.searchSource}',
        description: '{settings.searchSourceDescription}',
        type: 'selection',
        default: 'netease',
        enum: ['netease'],
        enumName: ['{settings.sourceNetease}'],
      },
      {
        field: 'quality',
        name: '{settings.quality}',
        description: '{settings.qualityDescription}',
        type: 'selection',
        default: '320k',
        enum: ['128k', '320k', 'flac', 'flac24bit'],
        enumName: ['128K', '320K', 'FLAC', 'FLAC 24bit'],
      },
      {
        field: 'fileNameTemplate',
        name: '{settings.fileNameTemplate}',
        description: '{settings.fileNameTemplateDescription}',
        type: 'input',
        default: '{name} - {singer}',
      },
    ],
    resource: [
      {
        id: 'kw',
        name: '{kwName}',
        resource: ['musicUrl'],
      },
      {
        id: 'tx',
        name: '{txName}',
        resource: ['musicUrl'],
      },
      {
        id: 'wy',
        name: '{wyName}',
        resource: ['musicUrl'],
      },
      {
        id: 'kg',
        name: '{kgName}',
        resource: ['musicUrl'],
      },
      {
        id: 'mg',
        name: '{mgName}',
        resource: ['musicUrl'],
      },
    ],
    commands: [
      {
        command: 'addLocalSource',
        name: '{command.addLocalSourceName}',
        description: '{command.addLocalSourceDescription}',
      },
      {
        command: 'addRemoteSource',
        name: '{command.addRemoteSourceName}',
        description: '{command.addRemoteSourceDescription}',
      },
      {
        command: 'exportSources',
        name: '{command.exportSourcesName}',
        description: '{command.exportSourcesDescription}',
      },
      {
        command: 'downloadMusic',
        name: '{command.downloadMusicName}',
        description: '{command.downloadMusicDescription}',
      },
    ],
  },
  buildConfig: {
    isIsolateMode: true,
  },
}

export default config
