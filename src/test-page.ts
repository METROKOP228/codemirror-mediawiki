import {CodeMirror6} from '/codemirror-mediawiki/dist/main.min.js';
import type {Config} from 'wikiparser-node';

declare interface Test {
	desc: string;
	wikitext?: string;
	html: string;
}

(async () => {
	const tests: Test[] = await (await fetch('/wikiparser-node/test/parserTests.json')).json(),
		select = document.querySelector('select')!,
		textarea = document.querySelector('textarea')!,
		container = document.getElementById('frame')!,
		seen = new Set<string>(),
		parserConfig: Config = await (await fetch('/wikiparser-node/config/default.json')).json(),
		cm = new CodeMirror6(textarea, 'mediawiki', CodeMirror6.getMwConfig(parserConfig));
	Object.assign(window, {cm});
	let optgroup: HTMLOptGroupElement;
	for (const [i, {desc, wikitext}] of tests.entries()) {
		if (wikitext === undefined) {
			optgroup = document.createElement('optgroup');
			optgroup.label = desc;
			if (desc === 'legacyMedia') {
				optgroup.hidden = true;
			}
			select.append(optgroup);
		} else {
			const option = document.createElement('option');
			option.value = String(i);
			option.textContent = desc;
			// @ts-expect-error already assigned
			optgroup.append(option);
		}
	}

	/**
	 * Find unique tags in the HTML
	 * @param html The HTML content
	 */
	const findUnique = (html: string): Set<string> => {
		const temp = new Set<string>();
		for (const ele of html.match(/<\w.*?>/gu) ?? []) {
			const mt = /<(\w+(?=[\s/>]))(?:.*(\sclass="[^"]+"))?/u.exec(ele)!,
				tag = `<${mt[1]}${mt[2] ?? ''}>`;
			if (!seen.has(tag)) {
				temp.add(tag);
			}
		}
		return temp;
	};
	select.addEventListener('change', () => {
		const {wikitext, html} = tests[Number(select.value)]!;
		cm.setContent(wikitext || '');
		container.innerHTML = html;
		for (const img of container.querySelectorAll<HTMLImageElement>('img[src]')) {
			img.src = '/wikiparser-node/assets/bad-image.svg';
			img.removeAttribute('srcset');
		}
		select.selectedOptions[0]!.disabled = true;
		const tags = findUnique(html);
		for (const tag of tags) {
			seen.add(tag);
		}
	});
	container.addEventListener('click', e => {
		e.preventDefault();
	}, {capture: true});
	document.body.addEventListener('keydown', e => {
		if (e.metaKey && e.key === 'ArrowDown') {
			e.preventDefault();
			const {selectedIndex, options} = select;
			for (let i = selectedIndex + 1; i < options.length; i++) {
				if (!options[i]!.disabled) {
					const tags = findUnique(tests[i - 1]!.html);
					if (tags.size > 0) {
						select.selectedIndex = i;
						select.dispatchEvent(new Event('change'));
						break;
					}
				}
			}
		}
	});
})();