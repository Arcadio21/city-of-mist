import {MasterSession, SlaveSession} from "./sockets.mjs";
import {CityDialogs} from "./city-dialogs.mjs";


export class JuiceMasterSession extends MasterSession {
	/** getHTMLFn is a function that gets the JQuery object for the message and refreshFn is the function to call to refresh the power and such of the roll after adding the juice
	*/

	/** on update Fn is a handler Fn that takes ({ownerId, juiceId, direction, amount})
	*/
	constructor (onUpdateFn, actorId, moveId) {
		super();
		this.onUpdateFn = onUpdateFn;
		this.sendObj = {actorId, moveId};
	}

	get html() {
		return this.getHTMLFn();
	}

	setHandlers() {
		super.setHandlers();
		this.setReplyHandler("juice", this.onJuiceReply.bind(this));

	}


	async start() {
		this.registerSubscribers( game.users.filter( x=> !x.isGM));
		const result = await this.request("juice", this.sendObj);
		return result;

	}

	onJuiceReply({juiceOwnerId, direction, amount}, _meta, senderId) {
		this.onUpdateFn(juiceOwnerId, direction, amount);
	}

}

export class JuiceSlaveSession extends SlaveSession {

	setHandlers() {
		super.setHandlers();
		this.setRequestHandler("juice", this.onJuiceRequest.bind(this));
	}

	async onJuiceRequest(replyFn, dataObj) {
		const character = game.user.character;
		if (!character) {
			replyFn(null, "Error: No Character");
		}
		try {
			const {direction, amount, actorId} = 	await CityDialogs.getHelpHurt(dataObj, this);
			replyFn( {
				amount,
				direction,
				juiceOwnerId: actorId,
			} );
			this.dialog = null;
		} catch (err) {
			console.log("error in request");
			replyFn( null, err);
			return;
		}
	}

	setDialog(dialog) { this.dialog = dialog;}

	onDestroy() {
		super.onDestroy();
		try {
			if (this.dialog)
				this.dialog.close();
		} catch (e) {
			console.error(e);
		}
		this.dialog = null;
	}

}


export class TagReviewMasterSession extends MasterSession {

	/** provide an initial taglist, and a moveId
taglist ois of the form {
tag: fullFormatTag,
state: string (status of tag (REjected, Accepted, pending, etc),
}
*/
	constructor( tagList, moveId) {
		super();
		this.tagList = tagList;
		if (moveId == undefined)
			throw new Error("no move Id given");
		this.moveId = moveId;
	}

	setHandlers() {
		super.setHandlers();
		this.setReplyHandler("tagReview", this.onReply.bind(this));
	}

	async start() {
		this.registerSubscribers( game.users.filter( x=> x.isGM));
		let state = "pending";
		let returnTagList;
		const origTagList = this.tagList.slice();

		while (state != "approved") {
			try {
				const sendObj = {
					tagList: this.simplifiedTagList,
					moveId: this.moveId,
				}
				const results = await this.request("tagReview", sendObj);
				const result = results[0]?.value;
				if (!result) throw new Error("Empty result");
				// console.log(`Result Recieved: ${result?.state}`);
				state = result?.state;
				returnTagList = result.tagList
					.map( ( {item, amount, review} ) => {
						return {
							item: CityHelpers.resolveTagAndStatusShorthand(item),
							review,
							amount
						};
					});
				this.tagList = returnTagList;
			} catch (e) {
				console.error(e);
				ui.notifications.error("Problem resolving result from Tag Verify");
				throw new Error("AAAHAHHH!!");
			}
		}
		let filteredReturnTagList = returnTagList
			.filter( ({item: _item, review, amount: _amt}) => review == "approved");
		return filteredReturnTagList;
	}

	get simplifiedTagList() {
		return this.tagList
			.map ( item => {
				return {
					item : CityHelpers.fullTagOrStatusToShorthand(item.item),
					review: item.review,
					amount: item.amount,
				};
			});
	}

	onReply( dataObj, meta) {
		// console.log(`reply Recieved : ${dataObj?.state} `)
	}
}

export class TagReviewSlaveSession extends SlaveSession {
	setHandlers() {
		super.setHandlers();
		this.setRequestHandler("tagReview", this.onReviewRequest.bind(this));
	}

	async onReviewRequest(replyFn, dataObj) {
		const tagList = dataObj.tagList;
		const moveId = dataObj.moveId;
		const {tagList: newComplexTagList, state} = await CityDialogs.tagReview(tagList, moveId, this);
		const newSimpleTagList = newComplexTagList
			.map( ({review, amount, item}) => {
				return {
					review,
					amount,
					item: CityHelpers.fullTagOrStatusToShorthand(item)
				};
			});
		replyFn ( {
			tagList: newSimpleTagList,
			state
		});
	}

	async requestClarification	(itemId, ownerId) {
		const dataObj  = {
			itemId,
			ownerId,
			changeType: "request-clarification"
		};
		await this.notify("tagUpdate", dataObj);
	}

	async approveTag	(itemId, ownerId) {
		const dataObj  = {
			itemId,
			ownerId,
			changeType: "approved"
		};
		await this.notify("tagUpdate", dataObj);
	}

	async rejectTag	(itemId, ownerId) {
		const dataObj  = {
			itemId,
			ownerId,
			changeType: "rejected"
		};
		await this.notify("tagUpdate", dataObj);
	}

}

export class JuiceSpendingSessionM extends MasterSession {
	constructor (juiceId, ownerId, amount) {
		super();
		this.dataObj = { juiceId, ownerId, amount};
	}

	async start() {
		const gm = game.users.find(x=> x.isGM && x.active);
		if (!gm) throw new Error("No GM found to spend juice!");
		this.registerSubscribers([gm]);
		const result = await this.request("spendJuice", this.dataObj);
		return result;
	}
}

export class JuiceSpendingSessionS extends SlaveSession {
	setHandlers() {
		super.setHandlers();
		this.setRequestHandler("spendJuice", this.onSpendRequest.bind(this));
	}

	async onSpendRequest(replyFn,  data,_meta) {
		const{juiceId, ownerId, amount} = data
		const actor = game.actors.get(ownerId);
		if (actor) {
			const juice = await actor.getJuice(juiceId);
			await juice.spend(amount);
			replyFn({confirm: true});
		} else {
			replyFn(null, "error");
			throw new Error("Couldn't find actor");
		}
		replyFn ("Done");
	}
}

export class DummyMasterSession extends MasterSession {

	setHandlers () {
		super.setHandlers();
		this.setReplyHandler("juice", this.onJuiceReply.bind(this));
	}

	async start() {
		this.registerSubscribers(game.users);
		console.log("Starting 1");
		const result = await this.request("juice");
		console.log("Finished 1");
		console.log("Starting 2");
		const result2 = await this.request("juice");
		console.log("Finished 2");
		return await result2;
	}

	async onJuiceReply(dataObj, _meta, senderId) {
		console.log("Reply Recieved");
		const sender = game.users.find(x=> x.id == senderId);
		console.log(`${sender.name} said ${dataObj.amount}`);
	}

	defaultTimeOut(userId) {
		const user = game.users.find(x => x.id == userId);
		if (user.isGM)
			return Infinity;
		else
			return 60 * 5;
	}

}

export class DummySlaveSession extends SlaveSession {

	setHandlers() {
		super.setHandlers();
		this.setRequestHandler("juice", this.onJuiceRequest.bind(this));
	}

	async onJuiceRequest (replyFn, _dataobj) {
		if (!this.answer) this.answer = 42;
		console.log("Request Received");
		await CityHelpers.asyncwait(5);
		console.log("asking for more time");
		this.getTimeExtension(10);
		await CityHelpers.asyncwait(10);
		if (this.answer == 42)
			await replyFn( {
				amount: this.answer++
			});
		else
			await replyFn( null, "error");
		console.log("Replied Late ");
	}

}

