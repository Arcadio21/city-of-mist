export class CityItem extends Item {


	async getCrack() {
		return this.data.data.crack.reduce( (acc, i) => acc+i, 0);
	}

	async getAttention() {
		return this.data.data.attention.reduce( (acc, i) => acc+i, 0);
	}

	prepareDerivedData() {
		super.prepareDerivedData();
		switch (this.type){
			case "improvement":
				this.data.data.choice_type = this.getChoiceType();
				break;

			default: break;
		}
	}

	/*
	Options for effect_class on improvmeents
		THEME_DYN_SELECT: select a type of core move that is now dynamite when using tags from this theme.
		THEME_DYN_FACE: WHen using tag from this theme, face danger is dyanmtie
		THEME_DYN_HIT: WHen using tag from this theme, HWAYG is dyanmtie
		THEME_DYN_CHANGE: WHen using tag from this theme, CtG is dyanmtie
		OPTION_FACE_X: X is some number 0-9, unlocks extra options in moves (future)
		THEME_TAG_SELECT: used to tell choice type to select a tag

	*/

	hasEffectClass(cl) {
		return this.effect_classes.includes(cl);
		// return this.data.data.effect_class?.includes(cl) ?? false;
	}

	get effect_classes() {
		return this?.data?.data?.effect_class?.split(" ") ?? [];
	}

	isImprovementActivated(move_id, actor) {
		const move = CityHelpers.getMoveById(move_id);
		const moveAbbr = move.data.data.abbreviation;
		if (!this.data.data.effect_class)
			return false;
		if ( this.hasEffectClass(`ALWAYS_DYN_${moveAbbr}`) )
			return true;
		const theme = actor.getTheme(this.data.data.theme_id);
		if (theme) {
			const hasThemeTagActivated = actor.getActivatedTags()
				.filter(x => x.data.data.theme_id == theme.id)
				.length > 0;
			if ( this.hasEffectClass(`THEME_DYN_${moveAbbr}`) )
				return hasThemeTagActivated;
			if ( this.hasEffectClass("THEME_DYN_SELECT") && this.data.data.choice_item == move.name)
				return hasThemeTagActivated;
			return false;
		}
	}

	getActivatedEffect() {
		// console.log(`Getting Activated Efect for ${this.name}`);
		if (this.data.data.effect_class.includes("DYN"))
			return {dynamite: true};
		return {};
	}

	getChoiceType() {
		if (this.data.data.effect_class?.includes("THEME_DYN_SELECT"))
			return "core_move";
		if (this.data.data.effect_class?.includes("THEME_TAG_SELECT"))
			return "theme_tag";
		else return "";
	}

	getThemeType () {
		// return logos/mythos
		const themebook = this.getThemebook();
		if (themebook == null)
			throw new Error("ERROR Can't find themebook!");
		return themebook.data.data.type;
	}

	getThemebook() {
		return CityHelpers.getThemebook(this.data.data.themebook_name, this.data.data.themebook_id);
	}

	tags() {
		return this.actor.items.filter( x => x.type == "tag" && x.data.data.theme_id == this.id);
	}

	improvements () {
		return this.actor.items.filter( x => x.type == "improvement" && x.data.data.theme_id == this.id);
	}

	get type() {
		return this.data.type;
	}

	getBuildUpValue() {
		//used by theme
		const tagValue = this.tags().reduce( (a,tag) => tag.upgradeCost() + a , 0);
		const impValue = this.improvements().reduce( (a,imp) => a + imp.upgradeCost() , 0);
		return Math.max(0, impValue + tagValue - 3);
		//returns amount of BU points a theme has
	}

	developmentLevel () {
		//for themes
		const powertags = this.tags().filter(x=> x.data.data.subtype == "power" && !x.isBonusTag());
		const weaktags = this.tags().filter(x=> x.data.data.subtype == "weakness");
		const attention = this.attention() / 100; //setup as a decimal tie-breaker
		const improvements = this.improvements();
		const unspent = this.data.data.unspent_upgrades;
		const devel =  powertags.length - Math.max(0, weaktags.length-1) + improvements.length + unspent + attention;
		if (Number.isNaN(devel))
			throw new Error("NAN");
		return devel;
	}

	upgradeCost() {
		switch (this.data.type) {
			case "tag" :
				return this.isBonusTag() ? 0 : 1;
			case "improvement":
				return 1;
			default:
				throw new Error(`Trying to get upgrade cost of ${this.data.type}`);
		}
	}

	isBonusTag() {
		return this.data.data.tag_question == "_" || this.data.data.custom_tag;
	}

	async printDestructionManifest(BUImpGained) {
		//used on themes and returns html string
		const BUGenerated = this.getBuildUpValue();
		const tagdata = this.tags().map(x=> x.data);
		const impdata = this.improvements().map(x=> x.data);
		const manifest = await renderTemplate("systems/city-of-mist/templates/theme-destruction.html", { BUGenerated, owner: this.parent, theme: this.data, tags: tagdata, improvements: impdata, BUImpGained} );
		return manifest.replaceAll("\n", "");
	}

	async addFade(amount = 1) {
		//Proboably doesn't work for non 1 values
		const arr = this.data.data.crack;
		const moddata = CityHelpers.modArray(arr, amount)
		const newArr = moddata[0];
		await this.update( {data: {crack: newArr}});
		return !!moddata[1];
	}

	async removeFade(amount=-1) {
		//Proboably doesn't work for non 1 values
		const arr = this.data.data.crack;
		if (arr[0] == 0) return false; //Can't remove if there's no crack
		const moddata = CityHelpers.modArray(arr, -amount)
		const newArr = moddata[0];
		await this.update( {data: {crack: newArr}});
		return !!moddata[1];
	}

	async resetFade() {
		let unspent_upgrades = this.data.data.unspent_upgrades;
		unspent_upgrades--;
		const crack = [0, 0, 0];
		await this.update( {data: {crack, unspent_upgrades}});
	}

	async addAttention(amount=1) {
		//Proboably doesn't work for non 1 values
		const arr = this.data.data.attention;
		const moddata = CityHelpers.modArray(arr, amount);
		const newArr = moddata[0];
		let extra_upgrades = moddata[1];
		let unspent_upgrades = this.data.data.unspent_upgrades + extra_upgrades;
		let nascent = this.data.data.nascent;
		if (nascent && arr[0] == 0)  {
			extra_upgrades++;
			unspent_upgrades++;
		}
		else if (extra_upgrades > 0)
			nascent = false;
		await this.update( {data: {attention: newArr, unspent_upgrades, nascent}});
		return extra_upgrades;
	}

	async removeAttention(amount=1) {
		//Proboably doesn't work for non 1 values
		const arr = this.data.data.attention;
		const moddata = CityHelpers.modArray(arr, -amount);
		const newArr = moddata[0];
		let extra_upgrades=  moddata[1];
		let unspent_upgrades = this.data.data.unspent_upgrades + extra_upgrades;
		let nascent = this.data.data.nascent;
		if (nascent && newArr[0] == 0)  {
			extra_upgrades--;
			unspent_upgrades--;
		}
		else if (extra_upgrades > 0)
			nascent = false;
		await this.update( {data: {attention: newArr, unspent_upgrades, nascent}});
		return extra_upgrades;
	}

	attention() {
		return this.data.data.attention.reduce( (acc, x) => acc + x, 0);
	}

	async incUnspentUpgrades() {
		return await this.update( {"data.unspent_upgrades" : this.data.data.unspent_upgrades+1});
	}

	async burnTag( state =1 ) {
		await this.unselectForAll();
		await this.update({data: {burned: state}});
	}

	isBurned() {
		if (this.type == "tag")
			return this.data.data.burned != 0;
		else
			return false;
	}

	getImprovementUses() {
		return (this.data.data?.uses?.max) > 0 ? this.data.data.uses.current : Infinity;
	}

	async decrementImprovementUses() {
		const uses = this.getImprovementUses();
		if (uses <= 0)
			throw new Error(`Trying to Decrement 0 uses on ${this.data.name}`);
		if (uses > 999)
			return;
		const newUses = uses-1;
		await this.update( {"data.uses.current": newUses});
		if (newUses <= 0)
			await this.update( {"data.uses.expended": true});
	}

	async refreshImprovementUses() {
		const uses = this.getImprovementUses();
		if (uses > 999)
			return false;
		if (this.getImprovementUses() == this.data.data?.uses?.max)
			return false;
		await this.update( {"data.uses.current": this.data.data?.uses?.max});
		await this.update( {"data.uses.expended": false});
		return true;
	}


	async addStatus (ntier, newname=null) {
		const standardSystem =!game.settings.get("city-of-mist", "commutativeStatusAddition");
		newname = newname ?? this.data.name;
		let tier = this.data.data.tier;
		let pips = this.data.data.pips;
		if (ntier > tier) {
			if (standardSystem) {
				tier = ntier;
				pips = 0;
				ntier = 0;
			} else {
				const temp = tier;
				tier = ntier;
				ntier = temp;
			}
		}
		while (ntier-- > 0) {
			pips++;
			while (pips >= tier) {
				pips -= tier++;
			}
		}
		return await this.update( {name:newname, data: {tier, pips}});
	}

	async subtractStatus (ntier, newname=null) {
		newname = newname ?? this.data.name;
		let tier = this.data.data.tier;
		let pips = this.data.data.pips;
		pips = 0;
		tier = Math.max(tier - ntier, 0);
		return await this.update( {name:newname, data: {tier, pips}});
	}

	async decUnspentUpgrades() {
		const newval = this.data.data.unspent_upgrades-1;
		if (newval < 0)
			console.warn (`Possible Error: Theme ${this.data.name} lowered to ${newval} upgrade points`);
		return await this.update( {"data.unspent_upgrades" : newval});
	}

	async unselectForAll() {
		game.actors.forEach( actor => {
			if (actor.hasActivatedTag(this.id))
				 actor.toggleTagActivation(this.id);
		});
	}

	async setField (field, val) {
		let data = {};
		data[field] = val;
		return await this.update({data});
	}

	static generateMoveText(movedata, result, power = 1) {
		const numRes = CityItem.convertTextResultToNumeric(result);
		const data = movedata.data.data;
		let html = "";
		html += data.always;
		if (numRes == 2)
				html += data.onSuccess;
		if (numRes == 3)
				html += data.onDynamite;
		if (numRes == 1)
				html += data.onPartial;
		if (numRes == 0)
				html += data.onMiss;
		html = CityItem.substitutePower(html, power);
		return html;
	}

	getFormattedText (actor_id) {
		const actor = game.actors.get(actor_id);
		const name = actor?.getDisplayedName() ?? this.actor.getDisplayedName();
		Debug(this);
		return CityHelpers.nameSubstitution(this.data.data.html, {name});
	}

	static substitutePower(txt, power) {
		txt = txt.replace("PWR+3", Math.max(1, power+3));
		txt = txt.replace("PWR+2", Math.max(1, power+2));
		txt = txt.replace("PWR+1", Math.max(1, power+1));
		txt = txt.replace("PWRM4", Math.max(4, power));
		txt = txt.replace("PWRM3", Math.max(3, power));
		txt = txt.replace("PWRM2", Math.max(2, power));
		txt = txt.replace("PWR", Math.max(1, power));
		return txt;
	}

	static generateMoveList(movedata, result, power = 1) {
		const lists =  movedata.data.data.listConditionals;
		const filterList = lists.filter( x=> CityItem.meetsCondition(x.condition, result));
		return filterList.map (x=> {
			const text = CityItem.substitutePower(x.text, power);
			const cost = x.cost; //change for some moves
			return {	text, cost};
		});
	}

	static getMaxChoices (movedata, result, power = 1) {
		const effectClass = movedata.data.data.effect_class ?? "";
		let resstr = null;
		switch (result) {
			case "Dynamite": resstr = "DYN"; break;
			case "Success": resstr = "HIT"; break;
			case "Partial": resstr = "PAR"; break;
			case "Failure": resstr = "MIS"; break;
			default: throw new Error(`Unknown Result ${result}`);
		}
		//TODO: replace wtih regex
		let str = "CHOICE"+resstr;
		if (effectClass.includes(str + "1") )
			return 1;
		if (effectClass.includes(str + "2") )
			return 2;
		if (effectClass.includes(str + "3") )
			return 3;
		if (effectClass.includes(str + "4") )
			return 4;
		if (effectClass.includes(str + "PWR") )
			return power;
		return Infinity;
	}

	static convertTextResultToNumeric(result) {
		switch (result) {
			case "Dynamite":return 3;
			case "Success": return 2;
			case "Partial": return 1;
			case "Failure": return 0;
			default: throw new Error(`Unknown Result ${result}`);
		}
	}

	static meetsCondition(cond, result) {
		const numRes = CityItem.convertTextResultToNumeric(result);
		switch (cond) {
			case "gtPartial": return numRes >= 1;
			case "gtSuccess": return numRes >= 2;
			case "eqDynamite": return numRes == 3;
			case "eqPartial": return numRes == 1;
			case "eqSuccess": return numRes == 2;
			case "Always": return true;
			case "Miss": return numRes == 0;
			default:
				throw new Error(`Unkonwn Condition ${cond}`);
		}
	}

	versionIsLessThan(version) {
		return String(this.data.data.version) < String(version);
	}

	async updateVersion(version) {
		version = String(version);
		if (this.versionIsLessThan(version)) {
			console.debug (`Updated version of ${this.name} to ${version}`);
			return await this.update( {"data.version" : version});
		}
		if (version < this.data.data.version)
			console.warn (`Failed attempt to downgrade version of ${this.name} to ${version}`);

	}

	async updateGMMoveHTML() {
		// const data = this.data.data; //recommended replace by linter
		const {html, taglist, statuslist} = await this.generateGMMoveHTML();
		await this.update( {data : {statuslist, taglist, html}});
	}

	async generateGMMoveHTML() {
		const templateData = {move: this.data, data: this.data.data};
		const html = await renderTemplate("systems/city-of-mist/templates/gmmove-chat-description.html", templateData);
		return this.formatGMMoveText(html);
	}

	formatGMMoveText(html) {
		const {html:taghtml , taglist }  = CityHelpers.tagClassSubstitution(html);
		const {html: statushtml, statuslist } = CityHelpers.autoAddstatusClassSubstitution(taghtml);
		html = CityHelpers.statusClassSubstitution(statushtml);
		return {html, taglist, statuslist};
	}

	isHelpHurt() {
		if (this.type != "juice") return false;
		const subtype = this.data.data?.subtype;
		return subtype == "help" || subtype == "hurt";
	}

	isJournal() {
		return this.type == "journal";
	}

	getSubtype() {
		return this.type == "juice" && this.data.data?.subtype;
	}

	getTarget() {
		const targetId = this.data.data?.targetCharacterId;
		if (targetId)
			return game.actors.get(targetId);
		else return null;
	}

	getTargetName() {
		const target = this.getTarget();
		if (target)
			return target.name;
		else return "";
	}

	isHurt() { return this.type == "juice" && this.getSubtype() == "hurt"; }
	isHelp() { return this.type == "juice" && this.getSubtype() == "help"; }
	isJuice() { return this.type == "juice" && this.getSubtype() == ""; }

	getDisplayedName() {
		if (this.isJournal())
			return `${this.data.data.question}`;
		if (!this.isHelpHurt())
			return this.name;
		if (this.isHelp())
			return "Help " + this.getTargetName();
		if (this.isHurt())
			return "Hurt "+ this.getTargetName();
		else
			throw new Error("Something odd happened?");
	}

	async spend(amount= 1) {
		console.log("Running Clue Spend");
		const curr = this.getAmount();
		if (amount > curr)
			console.error("${this.name}: Trying to spend more ${this.type} (${amount}) than you have ${curr}");
		const obj = await this.update( {"data.amount": curr - amount});
		if (curr - amount <= 0) {
			console.log("DELETING");
			return await this.delete();
		}
		return obj;
	}

	getAmount() {
		return this.data.data.amount;
	}

	async reloadImprovementFromCompendium() {
		const themeId = this.data.data.theme_id;
		const owner =this.actor;
		let max_uses, description, effect_class;
		if (themeId) {
			const theme = await owner.getTheme(themeId);
			if (!theme) {
				console.log(`Deleting Dead Improvement ${this.name} (${owner.name})`);
				await this.delete();
				return null;
			}
			const themebook = await theme.getThemebook();
			const impobj = themebook.data.data.improvements;
			for (let ind in impobj) {
				if (impobj[ind].name == this.name) {
					let imp = impobj[ind];
					max_uses = imp.uses;
					description = imp.description;
					effect_class = imp.effect_class;
					break;
				}
			}
		} else {
			const BUList = await CityHelpers.getBuildUpImprovements();
			const imp = BUList.find ( x => x.name == this.name);
			description = imp.data.data.description;
			max_uses = imp.data.data.uses.max;
			effect_class = imp.data.data.effect_class;
		}
		if (!description)
			throw new Error(`Can't find improvmenet ${this.name}`);
		const curruses = this.data.data.uses.current;
		const updateObj = {
			data: {
				uses: {
					current: curruses ??  max_uses,
					max: max_uses,
					expended: (curruses ?? max_uses.max) < 1 && max_uses > 0
				},
				description: description,
				chosen: true,
				effect_class: effect_class,
			}
		};
		return await this.update(updateObj);
	}

	async spend_clue() {
		if (this.getAmount() <= 0)
			throw new Error("Can't spend clue with no amount")
		await CityHelpers.postClue( {
			actorId: this.actor.id,
			metaSource: this,
			method: this.data.data.method,
			source: this.data.data.source
		});
		await this.spend();
	}

}

