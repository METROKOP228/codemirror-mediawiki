import {trees, findRef} from '../src/ref';
import type {languages, editor, IDisposable, Position} from 'monaco-editor';

/**
 * 获取指定范围的文本
 * @param model
 * @param lineNumber 行号
 * @param startColumn 起点列号
 * @param endColumn 终点列号
 */
const getValueInRange = (
	model: editor.ITextModel,
	lineNumber: number,
	startColumn: number,
	endColumn: number,
): string => model.getValueInRange(new monaco.Range(lineNumber, startColumn, lineNumber, endColumn));

/**
 * 查找同名注释
 * @param model
 * @param pos 位置
 * @param all 是否查找全部
 */
const provideRef = async (
	model: editor.ITextModel,
	pos: Position,
	all?: boolean,
): Promise<languages.Location[] | null> => {
	const {lineNumber} = pos,
		column = model.getWordAtPosition(pos)?.endColumn ?? pos.column,
		before = getValueInRange(model, lineNumber, 1, column),
		after = getValueInRange(model, lineNumber, column, Infinity),
		mt1 = /(<ref\s(?:[^>]*\s)?name\s*)(?:=\s*(?:(["'])(?:(?!\2|>).)*|[^\s>"'][^\s>]*)?)?$/iu.exec(before),
		mt2 = /^[^>]*(?:>|$)/u.exec(after);
	if (!mt1 || !mt2) {
		return null;
	}
	const [{length}] = /\/?>$/u.exec(mt2[0]) ?? [''],
		tag = getValueInRange(model, lineNumber, mt1.index + mt1[1]!.length + 1, column + mt2[0].length - length),
		attr = /^\s*=\s*(?:(["'])(.*?)(?:\1|$)|(\S+))/u.exec(tag);
	if (!attr || attr[2] === '') {
		return null;
	}
	const refs = await findRef(model, attr[2] ?? attr[3]!, all);
	return refs.map(ref => ({
		range: monaco.Range.fromPositions(...ref.map(i => model.getPositionAt(i)) as [Position, Position]),
		uri: model.uri,
	}));
};

export const refDefinitionProvider: languages.DefinitionProvider = {
	async provideDefinition(model, pos) {
		return (await provideRef(model, pos))?.[0];
	},
};

export const refReferenceProvider: languages.ReferenceProvider = {
	async provideReferences(model, pos) {
		return provideRef(model, pos, true);
	},
};

export const refListener = (model: editor.ITextModel): IDisposable => model.onDidChangeContent(() => {
	const tree = trees.get(model);
	if (tree) {
		tree.docChanged = true;
	}
});