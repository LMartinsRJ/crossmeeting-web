export type Lang = 'pt' | 'en'

const strings = {
  pt: {
    nav: {
      briefing:      'Briefing do dia',
      agenda:        'Agenda',
      actions:       'Ações',
      meetings:      'Transcrições',
      people:        'Contatos',
      companies:     'Empresas',
      recipes:       'Recipes',
      spaces:        'Spaces',
      analytics:     'Analytics',
      trash:         'Lixeira',
      settings:      'Configurações',
      signOut:       'Sair',
    },
    settings: {
      title:         'Configurações',
      tabProfile:    'Perfil',
      tabApi:        'API & Integrações',
      tabWebhooks:   'Webhooks',
      language:      'Idioma da interface',
      languageHint:  'Define o idioma dos menus e textos do app',
      langPt:        '🇧🇷 Português',
      langEn:        '🇺🇸 English',
      savedOk:       'Idioma salvo',
    },
    common: {
      save:   'Salvar',
      cancel: 'Cancelar',
      delete: 'Excluir',
      close:  'Fechar',
    },
  },
  en: {
    nav: {
      briefing:      'Daily Briefing',
      agenda:        'Agenda',
      actions:       'Actions',
      meetings:      'Transcripts',
      people:        'Contacts',
      companies:     'Companies',
      recipes:       'Recipes',
      spaces:        'Spaces',
      analytics:     'Analytics',
      trash:         'Trash',
      settings:      'Settings',
      signOut:       'Sign out',
    },
    settings: {
      title:         'Settings',
      tabProfile:    'Profile',
      tabApi:        'API & Integrations',
      tabWebhooks:   'Webhooks',
      language:      'Interface language',
      languageHint:  'Sets the language for menus and app text',
      langPt:        '🇧🇷 Português',
      langEn:        '🇺🇸 English',
      savedOk:       'Language saved',
    },
    common: {
      save:   'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      close:  'Close',
    },
  },
}

export type Strings = typeof strings['pt']
export const t = (lang: Lang): Strings => strings[lang] as Strings
