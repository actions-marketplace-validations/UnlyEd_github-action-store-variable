/**
 * Receive and manage variables
 * Options:
 *  0: Set value "value" to variable "key"
 *  1: Retrieve value from variable "key"
 */
import {join} from 'path';
import {readFileSync, mkdirSync, writeFileSync} from 'fs';
import * as core from '@actions/core';
import {VariableDetail, VariableStatus} from "./types/variableStatus";
import {WORKDIR} from "./config";
import {ArtifactClient, UploadOptions} from "@actions/artifact";
import rimraf from "rimraf";

const artifact = require('@actions/artifact');
const io = require('@actions/io');

const defineVariableOperation = (variable: string): VariableStatus => {
    try {
        const variableContent: VariableDetail = {
            key: variable.split("=")[0],
            value: variable.split("=")[1]
        };
        if (typeof variableContent.key !== 'undefined' && typeof variableContent.value !== 'undefined') {
            return {
                operationToProceed: 0,
                variableDetail: variableContent
            }
        } else if (typeof variableContent.key !== undefined) {
            return {
                operationToProceed: 1,
                variableDetail: variableContent
            }
        } else {
            throw Error(`Both key and value are empty`)
        }
    } catch (error) {
        throw Error('Error type')
    }
}

const storeArtifact = async (variables: VariableDetail[]): Promise<void> => {
    const client: ArtifactClient = artifact.create();
    const artifactOptions: UploadOptions = {
        retentionDays: 1 // Only keep artifacts 1 day to avoid reach limit: https://github.com/actions/toolkit/blob/c861dd8859fe5294289fcada363ce9bc71e9d260/packages/artifact/src/internal/upload-options.ts#L1
    }
    const artifactsUploadPromises: Promise<any>[] = [];

    console.log(variables);

    for (const variable of variables) {
        rimraf.sync(WORKDIR);
        mkdirSync(WORKDIR);
        const file: string = join(WORKDIR, `${variable.key}.txt`);

        writeFileSync(file, variable.value, {encoding: 'utf8'});
        artifactsUploadPromises.push(client.uploadArtifact(variable.key, [file], process.cwd(), artifactOptions));
    }
    const uploadResponses = await Promise.all(artifactsUploadPromises);
    console.log(uploadResponses);
}

const retrieveArtifact = async (variables: VariableDetail[]): Promise<void> => {
    const client: ArtifactClient = artifact.create();

    for (const variable of variables) {
        try {
            rimraf.sync(WORKDIR);
            mkdirSync(WORKDIR);
            const file = join(WORKDIR, `${variable.key}.txt`);
            await client.downloadAllArtifacts(variable.key);
            variable.value = readFileSync(file, {encoding: 'utf8'}).toString();
        } catch (error) {
            core.warning(`Cannot retrieve variable ${variable.key}`)
        }
    }
}

const manageArtifacts = async (variables: string, delimiter: string): Promise<void> => {
    const variablesDetail: VariableStatus[] = [];

    for (const variable of variables.split(/\r?\n/)) {
        console.log("Debugging received line: ", variable);
        try {
            variablesDetail.push(defineVariableOperation(variable));
        } catch (error) {
            console.log(error)
        }
    }
    console.log("Before:")
    console.log(variablesDetail)
    await storeArtifact(variablesDetail.filter((variable: VariableStatus) => variable.operationToProceed === 0)
        .map((variable: VariableStatus) => variable.variableDetail));
    await retrieveArtifact(variablesDetail.filter((variable: VariableStatus) => variable.operationToProceed === 1)
        .map((variable: VariableStatus) => variable.variableDetail));
    console.log("After:")
    console.log(variablesDetail)
}

export default manageArtifacts;