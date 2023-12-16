import { Compartment } from '@codemirror/state';
import { EditorView, lineNumbers, keymap, highlightSpecialChars, highlightActiveLine } from '@codemirror/view';
import {
	syntaxHighlighting,
	defaultHighlightStyle,
	indentOnInput,
	StreamLanguage,
	LanguageSupport
} from '@codemirror/language';
import { defaultKeymap, historyKeymap, history } from '@codemirror/commands';
import { searchKeymap } from '@codemirror/search';
import { linter, lintGutter, lintKeymap } from '@codemirror/lint';
import { mediawiki, html } from './mediawiki';
import * as plugins from './plugins';
import type { ViewPlugin } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import type { Diagnostic } from '@codemirror/lint';
import type { Highlighter } from '@lezer/highlight';

export type { MwConfig } from './mediawiki';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const languages: Record<string, ( config?: any ) => LanguageSupport | []> = {
	plain: () => [],
	mediawiki,
	html
};
for ( const [
	language,
	parser
] of Object.entries( plugins ) ) {
	languages[ language ] = (): LanguageSupport => new LanguageSupport( StreamLanguage.define( parser ) );
}
const linters: Record<string, Extension> = {};
const lintGutterExtension = lintGutter();

export class CodeMirror6 {
	declare textarea: HTMLTextAreaElement;
	declare language: Compartment;
	declare linter: Compartment;
	declare extensions: Compartment;
	declare view: EditorView;

	/**
	 * @param textarea 文本框
	 * @param lang 语言
	 * @param config 语言设置
	 */
	constructor( textarea: HTMLTextAreaElement, lang = 'plain', config?: unknown ) {
		this.textarea = textarea;
		const { offsetHeight } = textarea;
		this.language = new Compartment();
		this.linter = new Compartment();
		this.extensions = new Compartment();
		const extensions = [
			this.language.of( languages[ lang ]!( config ) ),
			this.linter.of( [] ),
			this.extensions.of( [
				highlightActiveLine()
			] ),
			syntaxHighlighting( defaultHighlightStyle as Highlighter, { fallback: true } ),
			EditorView.contentAttributes.of( {
				accesskey: textarea.accessKey,
				dir: textarea.dir,
				lang: textarea.lang
			} ),
			lineNumbers(),
			EditorView.lineWrapping,
			history(),
			highlightSpecialChars(),
			indentOnInput(),
			keymap.of( [
				...defaultKeymap,
				...historyKeymap,
				...searchKeymap,
				...lintKeymap
			] )
		];
		this.view = new EditorView( {
			extensions,
			doc: textarea.value,
			parent: textarea.parentElement!
		} );
		this.view.dom.style.minHeight = '2em';
		this.view.dom.style.height = `${ offsetHeight }px`;
		this.view.requestMeasure();
		textarea.style.display = 'none';
		if ( textarea.form ) {
			textarea.form.addEventListener( 'submit', () => {
				this.save();
			} );
		}
	}

	/**
	 * 设置语言
	 * @param lang 语言
	 * @param config 语言设置
	 */
	setLanguage( lang = 'plain', config?: unknown ): void {
		this.view.dispatch( {
			effects: [
				this.language.reconfigure( languages[ lang ]!( config ) ),
				this.linter.reconfigure( lang in linters ? linters[ lang ]! : [] )
			]
		} );
	}

	/**
	 * 开始语法检查
	 * @param lintSource 语法检查函数
	 */
	lint( lintSource?: ( str: string ) => Diagnostic[] | Promise<Diagnostic[]> ): void {
		const lang = ( this.language.get( this.view.state ) as LanguageSupport | { language: undefined } ).language,
			name = lang ? lang.name : 'plain',
			linterExtension = lintSource
				? [
					linter( ( view: EditorView ) => lintSource( view.state.doc.toString() ) ),
					lintGutterExtension
				]
				: [];
		if ( lintSource ) {
			linters[ name ] = linterExtension;
		} else {
			delete linters[ name ];
		}
		this.view.dispatch( {
			effects: [
				this.linter.reconfigure( linterExtension )
			]
		} );
	}

	/** 立即更新语法检查 */
	update(): void {
		const extension = this.linter.get( this.view.state ) as [ unknown, ViewPlugin<{
			set: boolean;
			force(): void;
		}> ] | [];
		if ( extension.length > 0 ) {
			const plugin = this.view.plugin( extension[ 1 ]! )!;
			plugin.set = true;
			plugin.force();
		}
	}

	/** 保存至文本框 */
	save(): void {
		this.textarea.value = this.view.state.doc.toString();
	}
}
