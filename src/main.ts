import {Plugin, addIcon, Notice, Modal, App} from "obsidian"
import {parse} from 'node_modules/pdf2md/lib/util/pdf';
import {makeTransformations, transform} from 'node_modules/pdf2md/lib/util/transformations';
import pdfjs from 'node_modules/pdfjs-dist/build/pdf';
import worker from 'node_modules/pdfjs-dist/build/pdf.worker.entry';
import ExtractPDFSettings from "./ExtractPDFSettings";
import ExtractPDFSettingsTab from "./ExtractPDFSettingsTab";

addIcon('extract', '<path d="M16 71.25L16 24.5C16 19.8056 19.8056 16 24.5 16L71.25 16C75.9444 16 79.75 19.8056 79.75 24.5L79.75 41.5L71.25 41.5L71.25 24.5L24.5 24.5L24.5 71.25L41.5 71.25L41.5 79.75L24.5 79.75C19.8056 79.75 16 75.9444 16 71.25ZM42.7452 48.725L48.7547 42.7325L75.5 69.4778L75.5 54.25L84 54.25L84 84L54.25 84L54.25 75.5L69.4862 75.5L42.7452 48.725Z" fill="white" fill-opacity="0.5"/>')

export default class ExtractPDFPlugin extends Plugin {
	public settings: ExtractPDFSettings;
	private modal: SampleModal;

	async onload() {
		this.loadSettings();
		this.addSettingTab(new ExtractPDFSettingsTab(this.app, this));
		this.modal = new SampleModal(this.app);

		this.addRibbonIcon('extract', 'Extract PDF', () => {
			this.extract();
		});
	}

	loadSettings() {
		this.settings = new ExtractPDFSettings();
		(async () => {
			const loadedSettings: ExtractPDFSettings = await this.loadData();
			if (loadedSettings) {
				console.log("Found existing settings file");
				this.settings.createNewFile = loadedSettings.createNewFile;
				this.settings.copyToClipboard = loadedSettings.copyToClipboard;
			} else {
				console.log("No settings file found, saving...");
				this.saveData(this.settings);
			}
		})();
	}

	async extract()  {
		let activeLeaf: any = this.app.workspace.activeLeaf ?? null

		if (typeof activeLeaf?.view.file == 'undefined') return;

		let pdfPath = activeLeaf?.view.file.path;

		if(!pdfPath.endsWith(".pdf")) return;

		const vaultPath = activeLeaf?.view.file.vault.adapter.basePath;
		const onlyPath = vaultPath + "/" + pdfPath;
		const theFullPath = "file://" + onlyPath;

		this.modal.fileName = pdfPath;
		this.modal.open();

		pdfjs.GlobalWorkerOptions.workerSrc = worker;

		// @ts-ignore
		var loadingTask = pdfjsLib.getDocument(theFullPath);

		var resultMD = await loadingTask.promise
			// @ts-ignore
			.then(async function (doc) {
				// make sure that in parse() it's not tryint to re-open another doc!
				var result = await parse(doc);
				const {fonts, pages} = result
				const transformations = makeTransformations(fonts.map)
				const parseResult = transform(pages, transformations)
				const text = parseResult.pages
					// @ts-ignore
					.map(page => page.items.join('\n'))
					.join('---\n\n')

				return text;
			});

		const filePath = pdfPath.replace(".pdf", ".md");

		if(this.settings.copyToClipboard) {
			this.saveToClipboard(resultMD);
		}

		if(this.settings.createNewFile) {
			await this.saveToFile(filePath, resultMD);
			await this.app.workspace.openLinkText(filePath, filePath, true);
		}

		this.modal.close();

	}

	saveToClipboard(data: string) {
		if (data.length > 0) {
			navigator.clipboard.writeText(data);
  		} else {
			new Notice( "No text found");
		}
	}

	async saveToFile(filePath: string, mdString: string) {
		//If files exists then append content to existing file
		const fileExists = await this.app.vault.adapter.exists(filePath);
		if (fileExists) {
		} else {
			await this.app.vault.create(filePath, mdString);
		}
	}
}

class SampleModal extends Modal {
	public fileName: string;

	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let {contentEl} = this;
		contentEl.createEl("h2", {text: "Extract PDF Plugin"});
		contentEl.createEl("p", {text: 'Processing ' + this.fileName});
	}

	onClose() {
		let {contentEl} = this;
		contentEl.empty();
	}
}