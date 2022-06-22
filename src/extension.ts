// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import { register_memoryFileProvider, MemoryFile } from './src-external/memoryFile';


// this method is called when the extension is activated
// the extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "codepath-python" is now active!');

	register_memoryFileProvider(context);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('codepath-python.whereAmI', async () => {
		// // This code is executed every time the command is run
		vscode.window.showInformationMessage('Running whereAmI helper script...');

		let editor = vscode.window.activeTextEditor;
		if (!editor) { vscode.window.showInformationMessage('Failed, open a python file (that compiles)!'); return; }

		let resultMemoryFile = await asyncRunPythonHelperScript(context);

		console.log(`Open document...`);
		let doc = await vscode.workspace.openTextDocument(resultMemoryFile.getUri());
		//await peekAtResult(doc);

		console.log(`Show opened document...`);
		await vscode.window.showTextDocument(doc, { preview: true });
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() { }



async function asyncRunPythonHelperScript(context: vscode.ExtensionContext): Promise<MemoryFile> {
	let editor = vscode.window.activeTextEditor;
	if (!editor) { throw new Error("No editor is open!"); }

	let document = editor.document;

	let config = vscode.workspace.getConfiguration();

	let pythonPath = config.get("codepath-python.pythonPath");
	if (!pythonPath) {
		pythonPath = config.get("python.defaultInterpreterPath");
	}
	if (!pythonPath) {
		pythonPath = "python";
	}
	console.log(`Python path: ${pythonPath}`);


	// we want `row 1` to be the first line, so offset the zero-based vscode line/character values.
	let row = editor.selection.active.line + 1;
	let col = editor.selection.active.character + 1;

	const runscript = async () => {
		return new Promise<string>(async (resolve, reject) => {
			
			let pyScript = context.asAbsolutePath('src/helper.py');

			// Run the script. The '-u' flag is 'unbuffered' mode
			const child = spawn(`${pythonPath}`, ['-u', pyScript, String(row), String(col)]);

			child.on('close', () => { console.log("CLOSED"); });
			child.on('error', (err) => {
				console.log(`ERROR ${err}`);
				reject(err);
			});
			child.on('disconnect', () => { console.log("DISCONNECT"); });
			//child.on('message', () => { console.log("MESSAGE"); });

			let allStdOut = "";
			child.stdout.on('data', (data) => {
				//console.log('stdout: ' + data);
				allStdOut += data;
				//console.log(result);
			});

			let allStdErr = "";
			child.stderr.on('data', (data) => {
				//console.log('stdout: ' + data);
				allStdErr += data;
				//console.log(result);
			});

			child.on('exit', (exitCode) => {
				console.log("EXITED! stderrr, if any, follows:");
				console.log(allStdErr + "\n---");
				resolve(allStdOut); // when this is eventually triggered, the Promise returns this stdOut
			});

			let currentWindowContents = document.getText();
			const Readable = require('stream').Readable;
			const s = new Readable();

			child.stdin.write(currentWindowContents + "\r\n");
			child.stdin.end();
		});
	};

	console.log(`Run script...`);
	const result = await runscript();

	console.log(`Dump results to vscode document...`);
	let memFile = MemoryFile.createDocument(".tmp");
	memFile.write(result);

	console.log(`Python script helper completed, returning result. ${result}`);
	return memFile;
}




// unused, was not working with virtualDocument/memoryFile, should work for file.
async function _peekAtResult(doc: vscode.TextDocument) {
	try {
		let editor = vscode.window.activeTextEditor;
		let success = await vscode.commands.executeCommand(
			'editor.action.peekLocations',
			editor!.document.uri,
			editor!.selection.active,
			[doc],
			'goto',
			"No results? Why, god, why?"
		);
		console.log(`PeekAtResult()`);
		//vscode.window.showInformationMessage('Allegedly opened editor');
	}
	catch (error) {
		console.log(`Peek failed with error ${error}`);
	}
}
