import {CDN, REPO_CDN} from './base';

const storageKey = 'codemirror-mediawiki-i18n',
	i18n: Record<string, string> = JSON.parse(localStorage.getItem(storageKey)!) || {},
	languages: Record<string, string> = {
		zh: 'zh-hans',
		'zh-hans': 'zh-hans',
		'zh-cn': 'zh-hans',
		'zh-my': 'zh-hans',
		'zh-sg': 'zh-hans',
		'zh-hant': 'zh-hant',
		'zh-tw': 'zh-hant',
		'zh-hk': 'zh-hant',
		'zh-mo': 'zh-hant',
	},
	lang = languages[mw.config.get('wgUserLanguage')] || 'en';

/** 加载 I18N */
export const setI18N = async (): Promise<void> => {
	if (i18n['lang'] !== lang || i18n['version'] !== REPO_CDN.split('@')[1]!.split('.', 2).join('.')) {
		Object.assign(i18n, await (await fetch(`${CDN}/${REPO_CDN}/i18n/${lang}.json`)).json());
		localStorage.setItem(storageKey, JSON.stringify(i18n));
	}
	for (const [k, v] of Object.entries(i18n)) {
		mw.messages.set(`cm-mw-${k}`, v);
	}
};

/**
 * 获取I18N消息
 * @param key 消息键，省略`cm-mw-`前缀
 * @param args 替换`$1`等的参数
 */
export const msg = (key: string, ...args: string[]): string => mw.msg(`cm-mw-${key}`, ...args);