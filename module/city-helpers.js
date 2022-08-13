// import { CityActor } from "./city-actor.js";
import { CityRoll } from "./city-roll.js";
import { CityDB } from "./city-db.mjs";
import { HTMLTools } from "./tools/HTMLTools.mjs";
import { CityLogger } from "./city-logger.mjs";
import { Sounds } from "./tools/sounds.mjs";
import { TokenTools } from "./tools/token-tools.mjs";


export class CityHelpers {

	static get dangerTemplates() { return CityDB.dangerTemplates; }
	static getAllActorsByType (item_type ="") { return CityDB.filterActorsByType(item_type); }
	static getAllItemsByType(item_type ="") { return CityDB.filterItemsByType(item_type); }
	static findAllById(id, type = "Actor") { return CityDB.findById(id, type); }
	static getThemebooks() { return CityDB.themebooks; }
	static getMoves() { return CityDB.movesList; }
	static getDangerTemplate(id) { return CityDB.getDangerTemplate(id); }
	static getThemebook(tname, id) { return CityDB.getThemebook(tname, id); }
	static async modificationLog(...args) { return await CityLogger.modificationLog(...args); }
	static async logToChat(actor, action, object = null, aftermsg = "") { return await CityLogger.logToChat(actor, action, object, aftermsg); }
	static async sendToChat(text, sender={}) { return await CityLogger.sendToChat(text, sender);
	}

	static getMoveById(moveId) {
		return this.getMoves().find(x => x.id == moveId);
	}

	static async asyncwait(sec) {
		return await new Promise ( (succ, _fail) => {
			setTimeout(() => succ(true), sec * 1000);
		});
	}

	static async getUserId() {
		if (game.userId != null)
			return game.userId;
		else
			throw new Error("Unknown User");
	}
	static async playLockOpen() {
		return await this.playSound("lock.mp3", 0.3);
	}

	static async playLockClosed() {
		return await this.playSound("lock.mp3", 0.5);
	}

	static async playBurn() {
		return await this.playSound("burn-tag.mp3", 0.5);
	}

	static async playTagOn() {
		return await this.playSound("button-on.mp3");
	}

	static async playTagOff() {
		return await this.playSound("button-off.mp3");
	}

	static async playWriteJournal() {
		return await this.playSound("button-on.mp3");
	}

	static async playSound(filename, volume = 1.0) {
		return await Sounds.playSound(filename, volume);
	}

	static getTagOwnerById(tagOwnerId) {
		return CityDB.getTagOwnerById(tagOwnerId);
	}

	static getOwner(ownerId, tokenId, sceneId) {
		if (!ownerId)
			throw new Error(`No owner Id provided to CityHelpers.getOwner`);
		if (!sceneId) {
			const id = CityHelpers.findAllById(ownerId) ;
			if (!id) throw new Error (`Can't find owner for ownerId ${ownerId}`);
			return id;
		} else {
			const scene = game.scenes.find (x=> x.id == sceneId);
			if (!scene)
				throw new Error(` Couldn't find Scene ID ${sceneId}`);
			if (!tokenId)
				throw new Error(` No Token Id provided`);
			const sceneTokenActors = this.getSceneTokenActors(scene);
			return sceneTokenActors.find( x=> x?.token?.id == tokenId);
		}
	}

	static getActiveScene() {
		return TokenTools.getActiveScene();
	}

	static getActiveSceneTokens() {
		return TokenTools.getActiveSceneTokens();
	}

	static getSceneTokens( scene) {
		return TokenTools.getSceneTokens(scene);
	}

	static getActiveSceneTokenActors() {
		return TokenTools.getActiveSceneTokenActors();
	}

	static getVisibleActiveSceneTokenActors() {
		return TokenTools.getVisibleActiveSceneTokenActors();
	}

	static getSceneTokenActors(scene) {
		return TokenTools.getSceneTokenActors(scene);
	}

	static createTokenActorData(tokendata) {
		//creates specialized dummy data, probably isn't needed
		const token = new Token(tokendata);
		const created = token.actor;
		created._tokenname = token.name;
		created._tokenid = token.name;
		created._hidden = token.data.hidden;
		return created;
	}

	static getActiveUnlinkedSceneTokens() {
		return TokenTools.getActiveUnlinkedSceneTokens();
	}

	static async getBuildUpImprovements() {
		return CityDB.getBuildUpImprovements();
	}

	static generateSelectHTML(listobj, currval, cssclass ="", id = "") {
		let html = new String();
		html += `<select `;
		if (id.length > 0)
			html += `id=${id} `;
		if (cssclass.length > 0)
			html += `class=${cssclass} `;
		html += `>`;
		for (let k of Object.keys(listobj)) {
			let selected = k == currval;
			html += `<option value=${k} `;
			if (selected)
				html += `selected`;
			html += `>${listobj[k]}</option>`;
		}
		html+=`</select>`;
		return html;
	}

	static async narratorDialog(container= null) {
		if (game.users.current.role != 4)
			return;
		if (!game.user.isGM)
			return;
		// support function
		const getCaret = function getCaret(el) {
			if (el.selectionStart) {
				return el.selectionStart;
			} else if (document.selection) {
				el.focus();
				var r = document.selection.createRange();
				if (r == null) {
					return 0;
				}
				var re = el.createTextRange(), rc = re.duplicate();
				re.moveToBookmark(r.getBookmark());
				rc.setEndPoint('EndToStart', re);
				return rc.text.length;
			}
			return 0;
		};
		if (!container)
			container = game.actors.find(x => x.data.type == "storyTagContainer");
		let html = new String();
		html += `<textarea class="narrator-text"></textarea>`;
		const submit = async function (html) {
			const text = $(html).find(".narrator-text").val();
			const {html :modified_html, taglist, statuslist} = CityHelpers.unifiedSubstitution(text);
			if (container)
				for ( const tagName of taglist.map(x=>x.name) )
					await container.createStoryTag(tagName);
			await CityHelpers.sendNarratedMessage(modified_html);
		}
		const options = {width: 900, height: 800};
		const dialog = new Dialog({
			title: `GM Narration`,
			content: html,
			render: (html) => {
				setTimeout ( () => $(html).find(".narrator-text").focus(), 10); //delay focus to avoid keypress showing up in window
				$(html).find(".narrator-text").keypress(function (event) {
					if (event.keyCode == 13) { //enter key
						const content = this.value;
						const caret = getCaret(this); //bug here that splits string poorly
						event.preventDefault();
						if (event.shiftKey)  {
							this.value = content.substring(0, caret ) + "\n" + content.substring(caret, content.length);
							event.stopPropagation();
						} else {
							event.stopPropagation();
							const defaultChoice = dialog.data.buttons.one;
							return dialog.submit(defaultChoice);
						}
					}
				});
			},
			buttons: {
				one: {
					icon: '<i class="fas fa-check"></i>',
					label: "Add",
					callback: (html) => submit(html)
				},
				two: {
					icon: '<i class="fas fa-times"></i>',
					label: "Cancel",
					callback: () => false
				}
			}
		}, options);
		if (!$(document).find(".narrator-text").length)
			dialog.render(true);
	}

	static parseTags(text) {
		let retarr = [];
		const regex = /\[([^\]]*)\]/gm;
		let match = regex.exec(text);
		while (match != null){
			let tagName = match[1];
			tagName = tagName.replaceAll('[', '');
			tagName = tagName.replaceAll(']', '');
			retarr.push(tagName);
			match = regex.exec(text);
		}
		return retarr;
	}

	static nameSubstitution(text, replaceObj = {} ) {
		//Replaces text following a pound with the appropriate term in key,value in replaceObj
		//example: nameSubstitution("#name", {name: "Tom"})
		const regex = /\$(\w*)\b/gm;
		let match = regex.exec(text);
		//TODO: FIX THIS
		while (match != null) {
			let replacetext = match[1];
			let lowerify = replacetext.toLowerCase();
			if (replaceObj[lowerify] === undefined) {
				console.warn(`String ${replacetext} not found in replacement Object`)
				text = text.replace('$' + replacetext, '?????');
				match = regex.exec(text);
				continue;
			}
			text = text.replace('$' + replacetext, replaceObj[lowerify]);
			match = regex.exec(text);
		}
		return text;
	}

	static unifiedSubstitution(text, status_mod = 0) {
		// const regex= /\[([ \w,]*:)?([\w\- ]+)\]/gm;
		const regex= /\[([ \w,]*:)?([\p{Letter}\d\- ]+)\]/gmu;
		let match = regex.exec(text);
		let taglist = [];
		let statuslist = [];
		let loop = 0;
		while (match != null) {
			if ( loop ++ > 1000 ) break;
			let options = CityHelpers.parseOptions(match[1]);
			const name = match[2];
			if (CityHelpers.isStatusParseable(name)) {
				const formatted_statusname = CityHelpers.replaceSpaces(name.substring(0, name.length-2));
				let tier = name.at(-1);
				if (tier != "X" && !options.includes("ignore-collective")) {
					tier = String(Number(tier) + status_mod);
				}
				const autoStatus = options.includes("auto-apply") ? "auto-status" : "";
				const newtext = `<span draggable="true" class="narrated-status-name draggable ${autoStatus}" data-draggable-type="status">${formatted_statusname}-<span class="status-tier">${tier}</span></span>`;
				text = text.replace(match[0], newtext);
				statuslist.push( {
					name: formatted_statusname,
					tier,
					options
				});
			} else {
				taglist.push({
					name,
					options
				});
				const newtext = `<span class="narrated-story-tag">${name}</span>`;
				text = text.replace(match[0] , newtext);
			}
			match = regex.exec(text);
		}
		return {
			html: text,
			taglist,
			statuslist
		};
	}

	static parseOptions(optionString) {
		if (! optionString?.length)
			return [];
		optionString = optionString.trim().substring(0,optionString.length-1); //shave off the colon
		return optionString.split(",")
			.map( option => {
			switch (option.trim()) {
				case "a":
					return "auto-apply";
				case "i":
					return "ignore-collective";
				default:
					console.warn(`Unrecognized option: ${option}`);
					return "";
			}
		});
	}

	static isStatusParseable(name) {
		const secondToLast = name.at(-2);
		if ( secondToLast != " " && secondToLast != "-")
			return false;
		const lastval = name.at(-1);
		const number_test = !Number.isNaN(Number(lastval));
		return number_test || lastval == "X";
	}

	static autoAddstatusClassSubstitution (text) {
		const regex = /\|\|([^|]+)\|\|/gm;
		let statuslist = [];
		let match = regex.exec(text);
		while (match != null) {
			const statusname = match[1];
			const formatted_statusname = CityHelpers.replaceSpaces(statusname.trim());
			const newtext = `<span class="narrated-status-name auto-status">${formatted_statusname}</span>`;
			text = text.replace('|' + statusname + '|' , newtext);
			match = regex.exec(text);
			statuslist.push(formatted_statusname);
		}
		const statuslistMod = statuslist.map( x=> {
			const regex = /(\D+)-(\d+)/gm;
			let match = regex.exec(x);
			while (match != null) {
				const name = match[1];
				const tier = match[2];
				return { name,
					tier,
					options:["auto-apply"]
				};
			}
			return null;
		}).filter( x=> x!= null);
		return {html: text, statuslist: statuslistMod};
	}

	static statusClassSubstitution(text) {
		//Change {TAG} into <span class="status-name"> TAG </span>
		const regex = /\|([^|]+)\|/gm;
		let match = regex.exec(text);
		while (match != null) {
			const statusname = match[1];
			const formatted_statusname = CityHelpers.replaceSpaces(statusname.trim());
			const newtext = `<span draggable="true" class="narrated-status-name draggable" data-draggable-type="status">${formatted_statusname}</span>`;
			text = text.replace('|' + statusname + '|' , newtext);
			match = regex.exec(text);
		}
		return text;
	}

	static replaceSpaces( text) {
		//for formatting statuses
		return text.replaceAll(" ", "-");
	}

	static async parseStatusString (str)  {
		const last = str.substring(str.length-1);
		const tier = Number(last);
		if (Number.isNaN(tier))
			throw new Error(`Malformed status ${str}`);
		const name = str.substring(0, str.length-2);
		return {name, tier};
	}

	static async sendNarratedMessage(text) {
		const templateData = {text};
		const html = await renderTemplate("systems/city-of-mist/templates/narration-box.html", templateData);
		const speaker = { alias:"Narration" };
		const messageData = {
			speaker: speaker,
			content: html,
			type: CONST.CHAT_MESSAGE_TYPES.OOC,
		}
		CONFIG.ChatMessage.documentClass.create(messageData, {})
	}

	static async itemDialog(item) {
		item.sheet.render(true);
		return await new Promise ( (conf, _rej) => {
			const checker = () =>  {
				const isOpen = item.sheet._state != -1; //window state check
				if (isOpen)
					setTimeout( checker, 500);
				else
					conf(item);
			}
			setTimeout(checker, 1000);
		});
	}

	static async refreshTokenActorsInScene(scene) {
		const scenetokens = scene.data.tokens;
		const characterActors = scenetokens
			.filter( x => x.isLinked &&
				x.actor.data.type == "character")
			.map (x => x.actor);
		for (const dep of characterActors) {
			const state = dep.sheet._state
			if (state > 0) {
				CityHelpers.refreshSheet(dep);
			}
		}
		return true;
	}

	static refreshSheet(actor) {
		setTimeout( () => actor.sheet.render(true, {}), 1);
	}

	static async ensureTokenLinked(_scene, token) {
		if (token.actorLink) return;
		await token.update ({ actorLink: true });
		return true;
	}

	static getTokenDisplayedName(token) {
		return token.name;
	}

	static modArray (array, amount = 1, arrlen = 3) {
		let improvements = 0;
		let breaker = 0;
		while (amount > 0) {
			if (breaker++ > 100) throw new Error("Endless Loop");
			array = array.map ( (i) => {
				if (i == 0 && amount > 0) {
					amount--;
					return 1;
				} else return i;
			});
			if (array[arrlen - 1] == 1) {
				array = new Array(arrlen).fill(0);
				improvements++;
			}
		}
		while (amount < 0) {
			if (breaker++ > 100) throw new Error("Endless Loop");
			array = array.reverse().map ( (i) => {
				if (i == 1 && amount < 0) {
					amount++;
					return 0;
				} else return i;
			});
			if (array[arrlen-1] == 0 && amount < 0) {
				array = new Array(arrlen).fill(1);
				improvements--;
			}
			array = array.reverse();
		}
		return [array, improvements];
	}

	static async confirmBox(title, text, defaultYes = false) {
		return await HTMLTools.confirmBox(title, text, defaultYes);
	}

	static middleClick (handler) { return HTMLTools.middleClick(handler); }
	static rightClick (handler) { return HTMLTools.rightClick(handler); }

	static getDefaultTagDirection(tag, tagowner, _actor) {
		const subtype = tag?.data?.data?.subtype;
		try {
			switch (subtype) {
				case "power": return 1;
				case "story":
					if (tagowner.type == "character")
						return 1;
					break;
				case null: throw new Error(`Resolution Error subtype ${subtype}, tag name: ${tag?.name}, owner: ${tagowner}`);
				default:
					return -1;
			}
		} catch(e) {
			Debug(tag);
			Debug(tagowner);
			console.warn(e);
		}
		return -1;
	}

	static async sessionEnd() {
		if (!game.user.isGM) return;
		const eos = localize("CityOfMist.dialog.endOfSession.name");
		const eosQuery = localize("CityOfMist.dialog.endOfSession.query");
		if	(await CityHelpers.confirmBox(eos, eosQuery)) {
			const move = CityHelpers.getMoves().find (x=> x.data.data.effect_class.includes("SESSION_END") )
			await CityRoll.execMove(move.id, null);
			for (let actor of game.actors)
				await actor.sessionEnd();
		}
	}

	static async startDowntime() {
		if (!game.user.isGM) return;
		const PCList = await this.downtimePCSelector();
		if (PCList === null) return;
		for (const pc of PCList) {
			await pc.onDowntime();
		}
		//TODO: Do downtime action selector (break up tag restore to own thing)
		await this.triggerDowntimeMoves();
	}

	/** displays dialog for selecting which PCs get downtime. Can return [actor], empty array for no one or null indicating a cancel
	*/
	static async downtimePCSelector() {
		const downtime = localize("CityOfMist.moves.downtime.name");
		const downtimeQuery = localize("CityOfMist.dialog.downtime.query");
		const PCList = game.actors.filter(x=> x.is_character());
		const idList =  await HTMLTools.PCSelector(PCList, downtime, downtimeQuery);
		return idList.map( id => PCList.find( actor => actor.id == id))
	}

	static async triggerDowntimeMoves() {
		const tokens = CityHelpers.getVisibleActiveSceneTokenActors();
		const dangermoves = tokens
			.filter(actor => actor.is_danger_or_extra())
			.map(actor=> actor.getGMMoves())
			.filter(gmmovearr => gmmovearr.length > 0)
			.flat(1)
			.filter(gmmove => gmmove.isDowntimeTriggeredMove());
		for (const move of dangermoves) {
			if (game.user.isGM)
				await move.GMMovePopUp();
		}


	}

	static applyColorization() {
		// const colorsetting = game.settings.get("city-of-mist", "color-theme") ;
		// if (colorsetting) {
		// 	document.documentElement.style.setProperty(
		// 		"--COM-COLOR-SCHEME",
		// 		colorsetting
		// 	);

		//NOTE: TEST CODE
		// document.documentElement.style.setProperty(
		// "--mythos-pink",
		// colorsetting
		// );
		// }
	}

	static async centerOnActorToken( actor) {
		let position = null;
		if (actor.isToken) {
			position = actor.parent._object.center;
		} else {
			const token = actor.getLinkedTokens().filter( x => x.scene == game.scenes.active)[0];
			if (!token)
				return;
			position = token.center;
		}
		if (position)
			await canvas.animatePan (position);
	}

	static entranceMovesEnabled() {
		const setting = game.settings.get("city-of-mist", "execEntranceMoves");
		return setting != "none";
	}


	static autoExecEntranceMoves() {
		const setting = game.settings.get("city-of-mist", "execEntranceMoves");
		return setting == "auto";
	}

	static async dragFunctionality(_app, html, _data) {
		html.find('.draggable').on("dragstart", this.dragStart.bind(this));
		html.find('.draggable').on("dragend", this.dragEnd.bind(this));
	}

	static async dragStart(event) {
		event.stopPropagation();
		$(event.currentTarget).addClass("dragging");
		return true;
	}

	static async dragEnd(event) {
		event.stopPropagation();
		$(event.currentTarget).removeClass("dragging");
		return true;
	}


	static getStatusAdditionSystem() {
return game.settings.get("city-of-mist", "statusAdditionSystem");
	}

	static getStatusSubtractionSystem() {
return game.settings.get("city-of-mist", "statusSubtractionSystem");
	}

	static isCommutativeStatusAddition() {
		return this.getStatusAdditionSystem() == "classic-commutative";
	}

	static isClassicCoM(elem) {
		switch (elem) {
			case "addition":
				return this.getStatusAdditionSystem().includes("classic");
			case "subtraction":
				return this.getStatusSubtractionSystem().includes("classic");
			default:
				const err =`Unknown setting for : ${elem}`;
				console.error(err);
				ui.notifications.warn(err);
				return false;
		}
	}

	static isCoMReloaded(elem) {
		switch (elem) {
			case "addition":
		return this.getStatusAdditionSystem().includes("reloaded");
			case "subtraction":
		return this.getStatusSubtractionSystem().includes("reloaded");
			default:
				const err =`Unknown setting for : ${elem}`;
				console.error(err);
				ui.notifications.warn(err);
				return false;
		}
	}

	static statusTierToBoxes(tier, pips=0) {
		while (tier > 0) {
			pips += Math.max(--tier, 1);
		}
		return pips;
	}

	static statusBoxesToTiers(boxes) {
		let pips = boxes;
		let tier = 0;
		while (pips >= tier && pips > 0)  {
			pips -= Math.max(tier++, 1);
		}
		if (tier == 0)
			pips = 0;
		return {pips, tier};

	}

	static getMaxWeaknessTags() {
		return game.settings.get('city-of-mist', "maxWeaknessTags") ?? 999;
	}

	static getRollCap() {
		return game.settings.get("city-of-mist", "maxRollCap");
	}

	static delay(time) {
		  return new Promise(resolve => setTimeout(resolve, time));
	}

	static refreshSystem(system) {
		try{
		if (!system)
			system = game.settings.get("city-of-mist", "system");
		} catch (e) {
			console.log("defaulting to classic CoM");
			system = "classic";
		}
		switch (system) {
			case "classic":
				game.settings.set("city-of-mist", "movesInclude_core", "classic");
				game.settings.set("city-of-mist", "movesInclude_advanced", "classic");
				game.settings.set("city-of-mist", "statusAdditionSystem", "classic");
				game.settings.set("city-of-mist", "statusSubtractionSystem", "classic");
				return;
			case "reloaded":
				game.settings.set("city-of-mist", "movesInclude_core", "reloaded");
				game.settings.set("city-of-mist", "movesInclude_advanced", "none");
				game.settings.set("city-of-mist", "statusAdditionSystem", "reloaded");
				game.settings.set("city-of-mist", "statusSubtractionSystem", "reloaded");
				return;
			case "custom":
				return;
			default:
				console.error(`Unknown System ${system}`);
		}
	}

	static async _statusAddSubDialog(status, title,type ="addition") {
		const classic = CityHelpers.isClassicCoM(type);
		const reloaded = CityHelpers.isCoMReloaded(type);
		const templateData = {status: status.data, data: status.data.data, classic, reloaded};
		const html = await renderTemplate("systems/city-of-mist/templates/dialogs/status-addition-dialog.html", templateData);
		return new Promise ( (conf, reject) => {
			const options ={};
			const returnfn = function (html, tier) {
				conf( {
					name: $(html).find(".status-name-input").val(),
					tier
				});
			}
			const dialog = new Dialog({
				title:`${title}`,
				content: html,
				buttons: {
					cancel: {
						label: "Cancel",
						callback: () => conf(null)
					},
					one: {
						label: "1",
						callback: (html) => returnfn(html, 1)
					},
					two: {
						label: "2",
						callback: (html) => returnfn(html, 2)
					},
					three: {
						label: "3",
						callback: (html) => returnfn(html, 3)
					},
					four: {
						label: "4",
						callback: (html) => returnfn(html, 4)
					},
					five: {
						label: "5",
						callback: (html) => returnfn(html, 5)
					},
					six: {
						label: "6",
						callback: (html) => returnfn(html, 6)
					},
				},
				default: "cancel"
			}, options);
			dialog.render(true);
		});
	}

	static _playerActivatedStuff = [];

	static getPlayerActivatedTagsAndStatus() {
		return this._playerActivatedStuff;
	}

	static activateTag( tag, direction= 1) { this.activateSelectedItem(tag, direction); }

	static activateStatus(status, direction= 1) { this.activateSelectedItem(status, direction); }

	static activateSelectedItem(tagOrStatus, direction = 1) {
		const x = tagOrStatus;
		const tagOwner = tagOrStatus?.parent;
		const tag = x.data.type == "tag" ? tagOrStatus : null;
		const subtype = tag ? tag.data.data.subtype : "";
		const amount = direction * (tag ? 1 : tagOrStatus.data.data.tier);
		const newItem = {
			name: x.name,
			id: x.id,
			amount,
			ownerId: tagOwner?.id ?? null ,
			tagId: tag ? x.id : null,
			type: x.type,
			description: tag ? tag.data.data.description : "",
			subtype,
			strikeout: false,
		}
		this._playerActivatedStuff.push(newItem);
	}

	static removeSelectedItem(tagOrStatusId) {
		this._playerActivatedStuff = this._playerActivatedStuff.filter( x=> x.id != tagOrStatusId);
	}

	/** returns -1, 0, 1 for which direction activateabley is set in
	*/
	static toggleSelectedItem(tagOrStatus, direction= 1) {
		// Debug(tagOrStatus);
		const item = this._playerActivatedStuff.find( x => x.id == tagOrStatus.id);
		if (item) {
			if (item.amount * direction >= 0) { //tests if sign of these is the same
				this.removeSelectedItem(tagOrStatus.id);
				return 0;
			} else {
				item.amount *=  -1;
				return item.amount;

			}
		} else {
			this.activateSelectedItem(tagOrStatus, direction);
			return direction;
		}
	}

	static clearAllActivatedItems() {
		this._playerActivatedStuff = [];
	}

	static async sendToChatBox(title, text, options = {}) {
		const label = options?.label ?? localize("CityOfMist.command.send_to_chat");
		const render = options?.disable ? (args) => {
			console.log("Trying to disable");
			$(args[2]).find(".one").prop('disabled', true).css("opacity", 0.5);
		} : () => 0;

		let sender = options?.speaker ?? {};
		if (!sender?.alias && sender.actor) {
			alias = actor.getDisplayedName();
		}
		return new Promise( (conf, rej) => {
			const options = {};
			let dialog = new Dialog({
				title: `${title}`,
				content: text,
				buttons: {
					one: {
						icon: '<i class="fas fa-check"></i>',
						label: label,
						callback: async() => conf(CityHelpers.sendToChat(text, sender)),
						// callback: async() => conf(CityHelpers.sendToChat(text, sender)),
					},
					two: {
						icon: '<i class="fas fa-times"></i>',
						label: localize("CityOfMist.command.cancel"),
						callback: async () => conf(null)
					}
				},
				default: "two",
				render
			}, options);
			dialog.render(true);
		});
	}

	static async GMMoveTextBox(title, text, options = {}) {
		const label = options?.label ?? localize("CityOfMist.command.send_to_chat");
		const render = options?.disable ? (args) => {
			console.log("Trying to disable");
			$(args[2]).find(".one").prop('disabled', true).css("opacity", 0.5);
		} : () => 0;

		let sender = options?.speaker ?? {};
		if (!sender?.alias && sender.actor) {
			alias = actor.getDisplayedName();
		}
		return new Promise( (conf, rej) => {
			const options = {};
			let dialog = new Dialog({
				title: `${title}`,
				content: text,
				buttons: {
					one: {
						icon: '<i class="fas fa-check"></i>',
						label: label,
						callback: async() => conf(true),
						// callback: async() => conf(CityHelpers.sendToChat(text, sender)),
					},
					two: {
						icon: '<i class="fas fa-times"></i>',
						label: localize("CityOfMist.command.cancel"),
						callback: async () => conf(null)
					}
				},
				default: "two",
				render
			}, options);
			dialog.render(true);
		});
	}

} //end of class
