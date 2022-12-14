"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Receive and manage variables
 * Options:
 *  0: Set value "value" to variable "key"
 *  1: Retrieve value from variable "key"
 */
const path_1 = require("path");
const fs_1 = require("fs");
const core = __importStar(require("@actions/core"));
const config_1 = require("./config");
const rimraf_1 = __importDefault(require("rimraf"));
const artifact = require('@actions/artifact');
const io = require('@actions/io');
const defineVariableOperation = (variable) => {
    try {
        const variableContent = {
            key: variable.split('=')[0],
            value: variable.split('=')[1],
        };
        if (typeof variableContent.key !== 'undefined' && typeof variableContent.value !== 'undefined') {
            return {
                operationToProceed: 0,
                detail: variableContent,
            };
        }
        else if (typeof variableContent.key !== undefined) {
            return {
                operationToProceed: 1,
                detail: variableContent,
            };
        }
        else {
            throw Error(`Both key and value are empty`);
        }
    }
    catch (error) {
        // An error will be thrown when the input doesn't have the expected format, or when the operation is unknown
        throw Error(`Input type error: ${error}`);
    }
};
const storeArtifact = (variables, failIfNotFound) => __awaiter(void 0, void 0, void 0, function* () {
    const client = artifact.create();
    const artifactOptions = {
        retentionDays: 1,
    };
    const artifactsUploadPromises = [];
    rimraf_1.default.sync(config_1.WORKDIR);
    fs_1.mkdirSync(config_1.WORKDIR);
    for (const variable of variables) {
        const file = path_1.join(config_1.WORKDIR, `${variable.key}.txt`);
        fs_1.writeFileSync(file, variable.value, { encoding: 'utf8' });
        artifactsUploadPromises.push(client.uploadArtifact(variable.key, [file], process.cwd(), artifactOptions));
    }
    try {
        const uploadResponses = yield Promise.all(artifactsUploadPromises);
        for (const variable of variables) {
            core.exportVariable(variable.key, variable.value);
            core.debug(`Imported ${variable.key}=${variable.value} and exported it back as ENV var`);
        }
    }
    catch (error) {
        const message = `Error while uploading artifact: ${error === null || error === void 0 ? void 0 : error.message}`;
        if (failIfNotFound) {
            core.setFailed(message);
        }
        else {
            core.warning(message);
        }
    }
});
const retrieveArtifact = (variables, failIfNotFound) => __awaiter(void 0, void 0, void 0, function* () {
    const client = artifact.create();
    rimraf_1.default.sync(config_1.WORKDIR);
    fs_1.mkdirSync(config_1.WORKDIR);
    for (const variable of variables) {
        try {
            const file = path_1.join(config_1.WORKDIR, `${variable.key}.txt`);
            yield client.downloadArtifact(variable.key);
            variable.value = fs_1.readFileSync(file, { encoding: 'utf8' }).toString();
            core.exportVariable(variable.key, variable.value);
            core.debug(`Exported ${variable.key}=${variable.value} as ENV var`);
        }
        catch (error) {
            const message = `Cannot retrieve variable ${variable.key}`;
            if (failIfNotFound) {
                core.setFailed(message);
            }
            else {
                core.warning(message);
            }
        }
    }
});
const manageArtifacts = (variables, delimiter, failIfNotFound) => __awaiter(void 0, void 0, void 0, function* () {
    const variablesDetail = [];
    for (const variable of variables.split(new RegExp(delimiter))) {
        try {
            variablesDetail.push(defineVariableOperation(variable));
        }
        catch (error) {
            console.log(error);
        }
    }
    yield storeArtifact(variablesDetail.filter((variable) => variable.operationToProceed === 0).map((variable) => variable.detail), failIfNotFound);
    yield retrieveArtifact(variablesDetail.filter((variable) => variable.operationToProceed === 1).map((variable) => variable.detail), failIfNotFound);
    const variablesResult = variablesDetail.reduce((variablesObject, variableToExport) => (Object.assign(Object.assign({}, variablesObject), { [variableToExport.detail.key]: variableToExport.detail.value })), {});
});
exports.default = manageArtifacts;
