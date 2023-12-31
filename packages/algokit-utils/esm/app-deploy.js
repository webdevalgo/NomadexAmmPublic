import algosdk from 'algosdk';

import { callApp, compileTeal, createApp, getAppById, updateApp } from './app.js';
import { lookupAccountCreatedApplicationByAddress, searchTransactions } from './indexer-lookup.js';
import { getSenderAddress, sendAtomicTransactionComposer } from './transaction.js';
import { APP_DEPLOY_NOTE_DAPP, DELETABLE_TEMPLATE_NAME, OnSchemaBreak, OnUpdate, UPDATABLE_TEMPLATE_NAME, } from './types/app.js';
var AtomicTransactionComposer = algosdk.AtomicTransactionComposer;
var getApplicationAddress = algosdk.getApplicationAddress;
var modelsv2 = algosdk.modelsv2;
var TransactionType = algosdk.TransactionType;
/**
 * Idempotently deploy (create, update/delete if changed) an app against the given name via the given creator account, including deploy-time template placeholder substitutions.
 *
 * To understand the architecture decisions behind this functionality please see https://github.com/algorandfoundation/algokit-cli/blob/main/docs/architecture-decisions/2023-01-12_smart-contract-deployment.md
 *
 * **Note:** When using the return from this function be sure to check `operationPerformed` to get access to various return properties like `transaction`, `confirmation` and `deleteResult`.
 *
 * **Note:** if there is a breaking state schema change to an existing app (and `onSchemaBreak` is set to `'replace'`) the existing app will be deleted and re-created.
 *
 * **Note:** if there is an update (different TEAL code) to an existing app (and `onUpdate` is set to `'replace'`) the existing app will be deleted and re-created.
 * @param deployment The arguments to control the app deployment
 * @param algod An algod client
 * @param indexer An indexer client, needed if `existingDeployments` not passed in
 * @returns The app reference of the new/existing app
 */
export async function deployApp(deployment, algod, indexer) {
    const { metadata, deployTimeParams: deployTimeParameters, onSchemaBreak, onUpdate, existingDeployments, createArgs, updateArgs, deleteArgs, createOnCompleteAction, ...appParams } = deployment;
    if (existingDeployments && existingDeployments.creator !== getSenderAddress(appParams.from)) {
        throw new Error(`Received invalid existingDeployments value for creator ${existingDeployments.creator} when attempting to deploy for creator ${appParams.from}`);
    }
    if (!existingDeployments && !indexer) {
        throw new Error(`Didn't receive an indexer client, but also didn't receive an existingDeployments cache - one of them must be provided`);
    }
    const compiledApproval = typeof appParams.approvalProgram === 'string'
        ? await performTemplateSubstitutionAndCompile(appParams.approvalProgram, algod, deployTimeParameters, metadata)
        : undefined;
    appParams.approvalProgram = compiledApproval ? compiledApproval.compiledBase64ToBytes : appParams.approvalProgram;
    const compiledClear = typeof appParams.clearStateProgram === 'string'
        ? await performTemplateSubstitutionAndCompile(appParams.clearStateProgram, algod, deployTimeParameters)
        : undefined;
    appParams.clearStateProgram = compiledClear ? compiledClear.compiledBase64ToBytes : appParams.clearStateProgram;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const apps = existingDeployments ?? (await getCreatorAppsByName(appParams.from, indexer));
    const create = async (atc) => {
        const result = await createApp({
            ...appParams,
            onCompleteAction: createOnCompleteAction,
            args: createArgs,
            note: getAppDeploymentTransactionNote(metadata),
            atc,
            skipWaiting: false,
        }, algod);
        return {
            transaction: result.transaction,
            transactions: result.transactions,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            confirmation: result.confirmation,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            confirmations: result.confirmations,
            return: result.return,
            appId: result.appId,
            appAddress: result.appAddress,
            createdMetadata: metadata,
            createdRound: Number(result.confirmation?.confirmedRound),
            updatedRound: Number(result.confirmation?.confirmedRound),
            ...metadata,
            deleted: false,
            operationPerformed: 'create',
            compiledApproval,
            compiledClear,
        };
    };
    const existingApp = apps.apps[metadata.name];
    if (!existingApp || existingApp.deleted) {
        return await create();
    }
    const existingAppRecord = await getAppById(existingApp.appId, algod);
    const existingApproval = Buffer.from(existingAppRecord.params.approvalProgram).toString('base64');
    const existingClear = Buffer.from(existingAppRecord.params.clearStateProgram).toString('base64');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const existingGlobalSchema = existingAppRecord.params.globalStateSchema;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const existingLocalSchema = existingAppRecord.params.localStateSchema;
    const newGlobalSchema = new modelsv2.ApplicationStateSchema({
        numByteSlice: appParams.schema.globalByteSlices,
        numUint: appParams.schema.globalInts,
    });
    const newLocalSchema = new modelsv2.ApplicationStateSchema({
        numByteSlice: appParams.schema.localByteSlices,
        numUint: appParams.schema.localInts,
    });
    const newApproval = Buffer.from(appParams.approvalProgram).toString('base64');
    const newClear = Buffer.from(appParams.clearStateProgram).toString('base64');
    const isUpdate = newApproval !== existingApproval || newClear !== existingClear;
    const isSchemaBreak = isSchemaIsBroken(existingGlobalSchema, newGlobalSchema) || isSchemaIsBroken(existingLocalSchema, newLocalSchema);
    const replace = async () => {
        const atc = new AtomicTransactionComposer();
        // Create
        const { transaction: createTransaction } = await create(atc);
        const createTransactions = atc.clone().buildGroup();
        // Delete
        const { transaction: deleteTransaction } = await callApp({
            appId: existingApp.appId,
            callType: 'delete_application',
            from: appParams.from,
            args: deleteArgs,
            transactionParams: appParams.transactionParams,
            suppressLog: appParams.suppressLog,
            skipSending: true,
            atc,
        }, algod);
        // Ensure create and delete happen atomically
        const { transactions, confirmations, returns } = await sendAtomicTransactionComposer({
            atc,
            sendParams: {
                maxRoundsToWaitForConfirmation: appParams.maxRoundsToWaitForConfirmation,
                skipWaiting: false,
                suppressLog: true,
            },
        }, algod);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const createConfirmation = confirmations[createTransactions.length - 1];
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const deleteConfirmation = confirmations[confirmations.length - 1];
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const newAppIndex = createConfirmation.applicationIndex;
        return {
            transaction: createTransaction,
            transactions: transactions,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            confirmation: createConfirmation,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            confirmations: confirmations,
            return: returns?.[0],
            deleteReturn: returns?.[1],
            appId: newAppIndex,
            appAddress: getApplicationAddress(newAppIndex),
            createdMetadata: metadata,
            createdRound: Number(createConfirmation.confirmedRound),
            updatedRound: Number(createConfirmation.confirmedRound),
            ...metadata,
            deleted: false,
            deleteResult: { transaction: deleteTransaction, confirmation: deleteConfirmation },
            operationPerformed: 'replace',
            compiledApproval,
            compiledClear,
        };
    };
    const update = async () => {
        const result = await updateApp({
            appId: existingApp.appId,
            from: appParams.from,
            args: updateArgs,
            note: getAppDeploymentTransactionNote(metadata),
            approvalProgram: appParams.approvalProgram,
            clearStateProgram: appParams.clearStateProgram,
            transactionParams: appParams.transactionParams,
            suppressLog: appParams.suppressLog,
            skipSending: false,
            skipWaiting: false,
        }, algod);
        return {
            transaction: result.transaction,
            transactions: result.transactions,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            confirmation: result.confirmation,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            confirmations: result.confirmations,
            return: result.return,
            appId: existingApp.appId,
            appAddress: existingApp.appAddress,
            createdMetadata: existingApp.createdMetadata,
            createdRound: existingApp.createdRound,
            updatedRound: Number(result.confirmation?.confirmedRound),
            ...metadata,
            deleted: false,
            operationPerformed: 'update',
            compiledApproval,
            compiledClear,
        };
    };
    if (isSchemaBreak) {
        if (onSchemaBreak === undefined || onSchemaBreak === 'fail' || onSchemaBreak === OnSchemaBreak.Fail) {
            throw new Error('Schema break detected and onSchemaBreak=OnSchemaBreak.Fail, stopping deployment. ' +
                'If you want to try deleting and recreating the app then ' +
                're-run with onSchemaBreak=OnSchemaBreak.ReplaceApp');
        }
        if (onSchemaBreak === 'append' || onSchemaBreak === OnSchemaBreak.AppendApp) {
            return await create();
        }
        return await replace();
    }
    if (isUpdate) {
        if (onUpdate === undefined || onUpdate === 'fail' || onUpdate === OnUpdate.Fail) {
            throw new Error('Update detected and onUpdate=Fail, stopping deployment. ' +
                'If you want to try deleting and recreating the app then ' +
                're-run with onUpdate=UpdateApp');
        }
        if (onUpdate === 'append' || onUpdate === OnUpdate.AppendApp) {
            return await create();
        }
        if (onUpdate === 'update' || onUpdate === OnUpdate.UpdateApp) {

            return await update();
        }
        if (onUpdate === 'replace' || onUpdate === OnUpdate.ReplaceApp) {
            return await replace();
        }
    }
    return { ...existingApp, operationPerformed: 'nothing', compiledApproval, compiledClear };
}
/** Returns true is there is a breaking change in the application state schema from before to after.
 *  i.e. if the schema becomes larger, since applications can't ask for more schema after creation.
 *  Otherwise, there is no error, the app just doesn't store data in the extra schema :(
 *
 * @param before The existing schema
 * @param after The new schema
 * @returns Whether or not there is a breaking change
 */
export function isSchemaIsBroken(before, after) {
    return before.numByteSlice < after.numByteSlice || before.numUint < after.numUint;
}
/**
 * Returns a lookup of name => app metadata (id, address, ...metadata) for all apps created by the given account that have an `AppDeployNote` in the transaction note of the creation transaction.
 *
 * **Note:** It's recommended this is only called once and then stored since it's a somewhat expensive operation (multiple indexer calls).
 *
 * @param creatorAccount The account (with private key loaded) or string address of an account that is the creator of the apps you want to search for
 * @param indexer An indexer client
 * @returns A name-based lookup of the app information (id, address)
 */
export async function getCreatorAppsByName(creatorAccount, indexer) {
    const appLookup = {};
    const creatorAddress = typeof creatorAccount !== 'string' ? getSenderAddress(creatorAccount) : creatorAccount;
    // Extract all apps that account created
    const createdApps = (await lookupAccountCreatedApplicationByAddress(indexer, creatorAddress))
        .map((a) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            return { id: a.id, createdAtRound: a['created-at-round'], deleted: a.deleted };
        })
        .sort((a, b) => a.createdAtRound - b.createdAtRound);
    // For each app that account created (in parallel)...
    const apps = await Promise.all(createdApps.map(async (createdApp) => {
        // Find any app transactions for that app in the round it was created (should always just be a single creation transaction)
        const appTransactions = await searchTransactions(indexer, (s) => s
            .minRound(createdApp.createdAtRound)
            .txType(TransactionType.appl)
            .applicationID(createdApp.id)
            .address(creatorAddress)
            .addressRole('sender')
            .notePrefix(Buffer.from(APP_DEPLOY_NOTE_DAPP).toString('base64')));
        // Triple check the transaction is intact by filtering for the one we want:
        //  * application-id is 0 when the app is first created
        //  * also verify the sender to prevent a potential security risk
        const appCreationTransaction = appTransactions.transactions.filter(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            (t) => t['application-transaction']['application-id'] === 0 && t.sender === creatorAddress)[0];
        const latestAppUpdateTransaction = appTransactions.transactions
            .filter((t) => t.sender === creatorAddress)
            .sort((a, b) => a['confirmed-round'] === b['confirmed-round']
                ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                (b['intra-round-offset'] - a['intra-round-offset']) / 10
                : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                b['confirmed-round'] - a['confirmed-round'])[0];
        if (!appCreationTransaction?.note)
            // No note; ignoring
            return null;
        return { createdApp, appCreationTransaction, latestAppUpdateTransaction };
    }));
    apps
        .filter((a) => a !== null)
        .forEach((a) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const { createdApp, appCreationTransaction, latestAppUpdateTransaction } = a;
            const parseNote = (note) => {
                if (!note) {
                    // No note; ignoring...
                    return;
                }
                const decoder = new TextDecoder();
                const noteAsBase64 = decoder.decode(Buffer.from(note));
                const noteAsString = Buffer.from(noteAsBase64, 'base64').toString('utf-8');
                if (!noteAsString.startsWith(`${APP_DEPLOY_NOTE_DAPP}:j{`))
                    // Clearly not APP_DEPLOY JSON; ignoring...
                    return;
                return JSON.parse(noteAsString.substring(APP_DEPLOY_NOTE_DAPP.length + 2));
            };
            try {
                const creationNote = parseNote(appCreationTransaction.note);
                const updateNote = parseNote(latestAppUpdateTransaction.note);
                if (creationNote?.name) {
                    appLookup[creationNote.name] = {
                        appId: createdApp.id,
                        appAddress: getApplicationAddress(createdApp.id),
                        createdMetadata: creationNote,
                        createdRound: Number(appCreationTransaction['confirmed-round']),
                        ...(updateNote ?? creationNote),
                        updatedRound: Number(latestAppUpdateTransaction?.['confirmed-round']),
                        deleted: createdApp.deleted ?? false,
                    };
                }
            }
            catch (e) {
                return;
            }
        });
    return {
        creator: creatorAddress,
        apps: appLookup,
    };
}
/**
 * Return the transaction note for an app deployment.
 * @param metadata The metadata of the deployment
 * @returns The transaction note as a utf-8 string
 */
export function getAppDeploymentTransactionNote(metadata) {
    return {
        dAppName: APP_DEPLOY_NOTE_DAPP,
        data: metadata,
        format: 'j',
    };
}
/**
 * Replaces deploy-time deployment control parameters within the given teal code.
 *
 * * `TMPL_UPDATABLE` for updatability / immutability control
 * * `TMPL_DELETABLE` for deletability / permanence control
 *
 * Note: If these values are not undefined, but the corresponding `TMPL_*` value
 *  isn't in the teal code it will throw an exception.
 *
 * @param tealCode The TEAL code to substitute
 * @param params The deploy-time deployment control parameter value to replace
 * @returns The replaced TEAL code
 */
export function replaceDeployTimeControlParams(tealCode, params) {
    if (params.updatable !== undefined) {
        if (!tealCode.includes(UPDATABLE_TEMPLATE_NAME)) {
            throw new Error(`Deploy-time updatability control requested for app deployment, but ${UPDATABLE_TEMPLATE_NAME} not present in TEAL code`);
        }
        tealCode = tealCode.replace(new RegExp(UPDATABLE_TEMPLATE_NAME, 'g'), (params.updatable ? 1 : 0).toString());
    }
    if (params.deletable !== undefined) {
        if (!tealCode.includes(DELETABLE_TEMPLATE_NAME)) {
            throw new Error(`Deploy-time deletability control requested for app deployment, but ${DELETABLE_TEMPLATE_NAME} not present in TEAL code`);
        }
        tealCode = tealCode.replace(new RegExp(DELETABLE_TEMPLATE_NAME, 'g'), (params.deletable ? 1 : 0).toString());
    }
    return tealCode;
}
/**
 * Performs template substitution of a teal file.
 *
 * Looks for `TMPL_{parameter}` for template replacements.
 *
 * @param tealCode The TEAL logic to compile
 * @param templateParams Any parameters to replace in the .teal file before compiling
 * @returns The TEAL code with replacements
 */
export function performTemplateSubstitution(tealCode, templateParams) {
    if (templateParams !== undefined) {
        for (const key in templateParams) {
            const value = templateParams[key];
            const token = `TMPL_${key.replace(/^TMPL_/, '')}`;
            tealCode = tealCode.replace(new RegExp(token, 'g'), typeof value === 'string'
                ? `0x${Buffer.from(value, 'utf-8').toString('hex')}`
                : ArrayBuffer.isView(value)
                    ? `0x${Buffer.from(value).toString('hex')}`
                    : value.toString());
        }
    }
    return tealCode;
}
/**
 * Performs template substitution of a teal file and compiles it, returning the compiled result.
 *
 * Looks for `TMPL_{parameter}` for template replacements.
 *
 * @param tealCode The TEAL logic to compile
 * @param algod An algod client
 * @param templateParams Any parameters to replace in the .teal file before compiling
 * @param deploymentMetadata The deployment metadata the app will be deployed with
 * @returns The information about the compiled code
 */
export async function performTemplateSubstitutionAndCompile(tealCode, algod, templateParams, deploymentMetadata) {
    tealCode = stripTealComments(tealCode);
    tealCode = performTemplateSubstitution(tealCode, templateParams);
    if (deploymentMetadata) {
        tealCode = replaceDeployTimeControlParams(tealCode, deploymentMetadata);
    }
    return await compileTeal(tealCode, algod);
}
/**
 * Remove comments from TEAL Code
 *
 * @param tealCode The TEAL logic to compile
 * @returns The TEAL without comments
 */
export function stripTealComments(tealCode) {
    // find // outside quotes, i.e. won't pick up "//not a comment"
    const regex = /\/\/(?=([^"\\]*(\\.|"([^"\\]*\\.)*[^"\\]*"))*[^"]*$)/;
    tealCode = tealCode
        .split('\n')
        .map((tealCodeLine) => {
            return tealCodeLine.split(regex)[0].trim();
        })
        .join('\n');
    return tealCode;
}
//# sourceMappingURL=app-deploy.js.map