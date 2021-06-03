import { CityItem } from "./city-item.js";

export async function CityRoll(moveId, actor, options = {}) {
	const {modifiers, tags} = await CityRoll.prepareModifiers(actor, options);
	const roll = await CityRoll.getRoll(options);
	const actorName = actor.name;
	const templateModifiers = modifiers.map ( x=> {
		const subtype = x.tag ? x.tag.data.data.subtype : "";
		return {
			type: x.type,
			amount: x.amount,
			subtype,
			name: x.name
		};
	});
	const templateData = {actorName, moveId, modifiers: templateModifiers, options};
	const html = await CityRoll.getContent(roll, templateData);
	const msg = await CityRoll.sendRollToChat(roll, html);
	await CityRoll.rollCleanupAndAftermath(tags, options);
   await actor.clearAllSelectedTags();
}

CityRoll.getContent = async function (roll, templateData) {
	const options = templateData.options;
	const power = CityRoll.getPower(templateData.modifiers);
	const moveId = templateData.moveId;
	const move = (await CityHelpers.getMoves()).find(x=> x.id == moveId);
	const total = roll.total + power;
	const roll_status = CityRoll.getRollStatus(total, options);
	templateData = Object.assign({}, templateData);
	templateData.moveName = move.name;
	templateData.moveList = CityItem.generateMoveList(move, roll_status, power);
	templateData.moveText = CityItem.generateMoveText(move, roll_status, power);
	templateData.rolls = (roll.terms)[0].results;
	templateData.total = total;

	templateData.modifiersString = JSON.stringify(templateData.modifiers);
	templateData.tdataString = JSON.stringify(templateData);
	const html = await renderTemplate("systems/city-of-mist/templates/city-roll.html", templateData);
	return html;
}

CityRoll.sendRollToChat = async function (roll, html, messageOptions = {}) {
	const messageData = {
		speaker: ChatMessage.getSpeaker(),
		content: html,
		user: game.user,
		type: CONST.CHAT_MESSAGE_TYPES.ROLL,
		sound: roll ? CONFIG.sounds.dice : null,
		roll
	};
	return ChatMessage.create(messageData, messageOptions);
	// CONFIG.ChatMessage.entityClass.create(messageData, {})
}

CityRoll.prepareModifiers = async function (actor, options) {
	const activated = actor.getActivated();
	const modifiersPromises = activated.map( async(x) => {
		const tagOwner = await CityHelpers.getOwner( x.tagOwnerId, x.tagTokenId, x.tagTokenSceneId);
		const tag = tagOwner ? await tagOwner.getSelectable(x.tagId) : null;
		return {
			name: x.name,
			id: x.tagId,
			amount: x.amount * x.direction,
			owner: tagOwner,
			tag,
			type: x.type
		};
	});
	const allModifiers = (await Promise.all(modifiersPromises)).filter (x =>{
		if (x.tag != null) {
			if (x.tag.isBurned())
				console.log(`Excluding ${x.tag.name}, value: ${x.tag.data.data.burned}`);
			return !x.tag.isBurned();
		}
		else return true;
	});
	let tags = [];
	if (!options.noTags) {
		tags = allModifiers.filter( x=> x.type == "tag");
		if (options.burnTag && options.burnTag.length) {
			tags = tags.filter(x => x.tag.id == options.burnTag);
			tags[0].amount = 3;
		}
	}
	let usedStatus = [];
	if (!options.noStatus) {
		const status = allModifiers.filter (x=> x.type == "status");
		const pstatus = status.filter(x => x.amount > 0);
		const nstatus = status.filter(x => x.amount < 0);
		const max = pstatus.reduce( (acc, x) => Math.max(acc, x.amount), -Infinity);
		const min = nstatus.reduce( (acc, x) => Math.min(acc, x.amount), Infinity);
		const statusMax = pstatus.find( x=> x.amount == max);
		const statusMin = nstatus.find( x=> x.amount == min);
		usedStatus = status.filter (x => x == statusMax || x == statusMin);
	}
	let modifiers = tags.concat(usedStatus);
	if (options.logosRoll) {
		modifiers.push({
			name: "Logos Themes",
			amount: actor.getNumberOfThemes("Logos"),
			owner: null,
			tag: null,
			type: "modifier"
		});
	}
	if (options.mythosRoll) {
		modifiers.push({
			name: "Mythos Themes",
			amount: actor.getNumberOfThemes("Mythos"),
			owner: null,
			tag: null,
			type: "modifier"
		});
	}
	if (options.modifier && options.modifier != 0) {
		modifiers.push({
			name: "Custom Modifier",
			amount: options.modifier,
			owner: null,
			tag: null,
			type: "modifier"
		});
	}
	const usedWeaknessTag = tags.some( x=> x.type == "tag" && x.tag.data.data.subtype == "weakness" && x.amount < 0);
	let modifiersTotal = modifiers.reduce( (acc, x)=> acc+x.amount, 0);
	if (usedWeaknessTag && game.settings.get("city-of-mist", "weaknessCap") < 100) {
		const cap = game.settings.get("city-of-mist", "weaknessCap");
		let capPenalty = -(modifiersTotal - cap);
		if (capPenalty != 0 && modifiersTotal > 0)
			modifiers.push( {
				name: "Weakness Cap Penalty",
				amount: capPenalty,
				owner: null,
				tag: null,
				type: "modifier"
			});
	}
	modifiersTotal = modifiers.reduce( (acc, x)=> acc+x.amount, 0);
	if (game.settings.get("city-of-mist", "gritMode")) {
		let gritpenalty = 0;
		if (modifiersTotal >=7)
			gritpenalty = -(modifiersTotal - 4);
		else if  (modifiersTotal >= 4)
			gritpenalty = -(modifiersTotal - 3);
		else if (modifiersTotal == 3)
			gritpenalty = -(modifiersTotal - 2);
		if (gritpenalty != 0)
			modifiers.push( {
				name: "Grit Penalty",
				amount: gritpenalty,
				owner: null,
				tag: null,
				type: "modifier"
			});
	}
	return {modifiers, tags};
}

CityRoll.getRoll = async function (options) {
	let rstring;
	if (options.noRoll) {
		rstring =`0d6+1000`;
	} else if (options.setRoll) {
		rstring =`0d6+${options.setRoll}`;
	} else  {
		rstring = `2d6`;
	}
	let r = new Roll(rstring, {});
	await r.roll({async:true});
	return r;
}

CityRoll.getRollStatus = function (total, options) {
	if (total>= 12 && options.dynamiteAllowed) {
		return "Dynamite";
	} else if (total >=10){
		return "Success";
	} else if (total >= 7) {
		return "Partial";
	} else {
		return "Failure";
	}
}

CityRoll.getPower = function (modifiers) {
	return modifiers.reduce( (acc, x)=> acc+x.amount, 0);
}

CityRoll.rollCleanupAndAftermath = async function (tags, options) {
	if (options.burnTag && options.burnTag.length)
		for (let {owner, tag} of tags)
			await owner.burnTag(tag.id);
	for (let {owner, tag, amount} of tags) {
		if (tag.data.data.crispy || tag.data.data.temporary) {
			try {await owner.burnTag(tag.id);}
			catch (e) {
				console.warn(`Unable to Burn tag ${tag.name}`);
			}
		}
		if (tag.data.data.subtype == "weakness" && amount < 0 ) {
			await owner.grantAttentionForWeaknessTag(tag.id);
		}
	}
}

CityRoll.modifierPopup = async function (move_id, actor) {
	const burnableTags = ( await actor.getActivated() ).filter(x => x.direction > 0 && x.type == "tag" && !x.crispy && x.subtype != "weakness" );
	const title = `Make Roll`;
	const templateData = {burnableTags, actor: actor.data, data: actor.data.data};
	const html = await renderTemplate("systems/city-of-mist/templates/dialogs/roll-dialog.html", templateData);
	const rollOptions =await  new Promise ( (conf, reject) => {
		const options ={};
		const dialog = new Dialog({
			title:`${title}`,
			content: html,
			buttons: {
				one: {
					icon: '<i class="fas fa-check"></i>',
					label: "Confirm",
					callback: (html) => {
						const modifier = Number($(html).find("#roll-modifier-amt").val());
						const dynamiteAllowed= $(html).find("#roll-dynamite-allowed").prop("checked");
						const burnTag = $(html).find("#roll-burn-tag option:selected").val();
						const setRoll = burnTag.length ? 7 : 0;
						const retObj  = {modifier, dynamiteAllowed, burnTag, setRoll};
						conf(retObj);
					},
				},
				two: {
					icon: '<i class="fas fa-times"></i>',
					label: "Cancel",
					callback: () => conf(null)
				}
			},
			default: "one"
		}, options);
		dialog.render(true);
	});
	if (rollOptions != null) {
		await CityRoll(move_id, actor, rollOptions);
	}
}

CityRoll.logosRoll = async function (move_id, actor) {
	const rollOptions = {
		noTags: true,
		noStatus: true,
		logosRoll: true,
		setRoll: 0
	};
	await CityRoll(move_id, actor, rollOptions);
}

CityRoll.mythosRoll = async function (move_id, actor) {
	const rollOptions = {
		noTags: true,
		noStatus: true,
		mythosRoll: true,
		setRoll: 0
	};
	await CityRoll(move_id, actor, rollOptions);
}

CityRoll.SHBRoll = async function (move_id, actor, type = "Logos") {
	const rollOptions = {
		noTags: true,
		noStatus: true,
		logosRoll: true,
		setRoll: 0
	};
	if (type == "Mythos") {
		rollOptions.logosRoll = false;
		rollOptions.mythosRoll = true;
	}
	await CityRoll(move_id, actor, rollOptions);
}

CityRoll.noRoll = async function (move_id, actor) {
	const rollOptions = {
		noTags: true,
		noStatus: true,
		noRoll: true
	};
	await CityRoll(move_id, actor, rollOptions);
}

CityRoll.diceModListeners = async function (app, html, data) {
	html.on('click', '.edit-roll', CityRoll._editRoll.bind(this));
}

CityRoll.showEditButton = async function (app, html, data) {
	if (game.user.isGM) {
		$(html).find('.edit-roll').css("display", "inline-block");
	}
}

CityRoll._editRoll = async function(event) {
	if (!game.user.isGM)
		return;
	const modifiers = getClosestData(event, "modifiers");
	let templateData  = getClosestData(event, "templateData");
	templateData = await CityRoll.getModifierBox(templateData);
	if (!templateData) return;
	const messageId  = getClosestData(event, "messageId");
	const message = game.messages.get(messageId);
	const roll = message.roll;
	const newContent = await CityRoll.getContent(roll, templateData);
	const msg = await message.update( {content: newContent});
	await ui.chat.updateMessage( msg, false);
}

CityRoll.getModifierBox = async function (templateData) {
	let dynamiteAllowed = templateData.options.dynamiteAllowed;
	const title = `Make Roll`;
	const html = await renderTemplate("systems/city-of-mist/templates/dialogs/roll-modification-dialog.html", templateData);
	const rollOptions = await  new Promise ( (conf, reject) => {
		const options = {};
		const dialog = new Dialog({
			title:`${title}`,
			content: html,
			buttons: {
				one: {
					icon: '<i class="fas fa-check"></i>',
					label: "Confirm",
					callback: (html) => {
						const modifier = Number($(html).find("#roll-modifier-amt").val());
						if (modifier != 0)
							templateData.modifiers.push ( {
								name: "MC Edit",
								amount: modifier,
								owner: null,
								tag: null,
								type: "modifier"
							});
						dynamiteAllowed = $(html).find("#roll-dynamite-allowed").prop("checked");
						templateData.options.dynamiteAllowed = dynamiteAllowed;
						conf(templateData);
					},
				},
				two: {
					icon: '<i class="fas fa-times"></i>',
					label: "Cancel",
					callback: () => conf(null)
				}
			},
			default: "one"
		}, options);
		dialog.render(true);
	});
	return rollOptions;
}

