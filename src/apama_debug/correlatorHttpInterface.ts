/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosError } from 'axios';
import { DOMParser } from '@xmldom/xmldom';
import * as xpath from 'xpath';
import { OutputChannel } from 'vscode';

export interface CorrelatorBreakpoint {
    filename: string;
    filehash: string;
    action: string;
    owner: string;
    line: number;
    id: string;
    breakonce: boolean;
}

export interface CorrelatorContextState {
    context: string;
    contextid: number;
    paused: boolean;
}

export interface CorrelatorPaused extends CorrelatorContextState {
    owner: string;
    type: string;
    action: string;
    instance: number;
    monitor: string;
    filename: string;
    filehash: string;
    reason: string;
    line: number;
}

export interface CorrelatorStackFrame {
    owner: string;
    type: string;
    action: string;
    lineno: number;
    filename: string;
    filehash: string;
}

export interface CorrelatorStackTrace {
    contextid: number;
    monitor: string;
    stackframes: CorrelatorStackFrame[];
}

export interface CorrelatorVariable {
    name: string;
    type: string;
    value: string;
}

export class CorrelatorHttpInterface {
    private url: string;
    constructor(private logger:OutputChannel, host: string, port: number) {
        this.url = `http://${host}:${port}`;
    }

    /** Sets a breakpoint and returns the id of the breakpoint. Throws an exception on error or failure. */
    public async setBreakpoint(filepath: string, line: number): Promise<string> {
        //console.log("setBreakpoint");
        const body = '<map name="apama-request">' +
            `<prop name="filename">${filepath}</prop>` +
            `<prop name="line">${line}</prop>` +
            '<prop name="breakonce">false</prop>' +
        '</map>';

        const url = `${this.url}/correlator/debug/breakpoint/location`;
        const response = await axios.put(url , body);
        const dom = new DOMParser().parseFromString(response.data, 'text/xml');
        return xpath.select1('string(/map[@name="apama-response"]/list[@name="ids"]/prop[@name="id"]//text())', dom)?.toString() ?? "";
    }

    public async deleteBreakpoint(id: string): Promise<void> {
        //console.log("deleteBreakpoint");
        const url = `${this.url}/correlator/debug/breakpoint/location/${id}`;
        try {
            await axios.delete(url);
            //console.log("DELETE RESPONSE = ");
            //console.log(response);
            return;
        }
        // eslint-disable-next-line no-empty
        catch {
        }
    }

    public async getAllSetBreakpoints(): Promise<CorrelatorBreakpoint[]> {
        //console.log("getAllSetBreakpoints");
        const response =  await axios.get(`${this.url}/correlator/debug/breakpoint`);
        ////console.log("resp"+response);
        const dom = new DOMParser().parseFromString(response.data, 'text/xml');
        const breakpointNodes = xpath.select('/map[@name="apama-response"]/list[@name="breakpoints"]/map[@name="filebreakpoint"]', dom) as Node[];

        // Have to convert the found breakpointNodes back to a string and then back to dom because this xpath implementation only finds from root node
        const bpStrings = breakpointNodes?.map((breakpointNode: { toString: () => any; }) => breakpointNode.toString()) ?? [];
        const breakpointDoms = bpStrings.map((bpString: string) => new DOMParser().parseFromString(bpString, 'text/xml'));
        
        const corrbps: CorrelatorBreakpoint[]=  breakpointDoms.map((breakpointDom: any) => ({
                    filename: xpath.select1('string(/map/prop[@name="filename"])', breakpointDom)?.toString() ?? "",
                    filehash: xpath.select1('string(/map/prop[@name="filehash"])', breakpointDom)?.toString() ?? "",
                    action: xpath.select1('string(/map/prop[@name="action"])', breakpointDom)?.toString() ?? "",
                    owner: xpath.select1('string(/map/prop[@name="owner"])', breakpointDom)?.toString() ?? "",
                    line: parseInt(xpath.select1('string(/map/prop[@name="line"])', breakpointDom)?.toString() ?? "0"),
                    id: xpath.select1('string(/map/prop[@name="id"])', breakpointDom)?.toString() ?? "",
                    breakonce: xpath.select1('string(/map/prop[@name="breakonce"])', breakpointDom) === 'true'}));
        //console.log(corrbps); 
        return corrbps;
    }

    public async enableDebugging(): Promise<void> {
        console.log("enableDebugging");
        const body = '<map name="apama-request"></map>';
        const response:any = await axios.put(`${this.url}/correlator/debug/state`, body);
        ////console.log(response);
        return response.data;
    }

    public async disableDebugging(): Promise<void> {
        console.log("disableDebugging");
        await axios.delete(`${this.url}/correlator/debug/state`);
        //console.log(response);
        return;
    }

    public async pause(): Promise<void> {
        console.log("pause");
        const body = '<map name="apama-request"></map>';
        const response:any = await axios.put(`${this.url}/correlator/debug/progress/stop`, body );
        //console.log(response);
        return response.data;
    }

    public async resume(): Promise<void> {
        console.log("resume");
        const body = '<map name="apama-request"></map>';
        const response:any = await axios.put(`${this.url}/correlator/debug/progress/run`, body );
        //console.log(response);
        return response.data;
    }

    public async stepIn(): Promise<void> {
        console.log("stepIn");
        const body = '<map name="apama-request"></map>';
        const response:any = await axios.put(`${this.url}/correlator/debug/progress/step`, body);
        //console.log(response);
        return response.data;
    }

    public async stepOver(): Promise<void> {
        console.log("stepOver");
        const body = '<map name="apama-request"></map>';
        const response:any = await axios.put(`${this.url}/correlator/debug/progress/stepover`, body);
        //console.log(response);
        return response.data;
    }

    public async stepOut(): Promise<void> {
        console.log("stepOut");
        const body = '<map name="apama-request"></map>';
        const response:any = await axios.put(`${this.url}/correlator/debug/progress/stepout`, body);
        //console.log(response);
        return response.data;
    }

    public async awaitPause(): Promise<CorrelatorPaused> {
        console.log("awaitPause");
        
        try {
            const response:any = await axios.get(`${this.url}/correlator/debug/progress/wait`, { timeout: 15000 });
            console.log("await pause returned");
            //console.log(response);
            const dom = new DOMParser().parseFromString(response.data, 'text/xml');
            const retVal = {
                context: xpath.select1('string(/map[@name="apama-response"]/map[@name="contextprogress"]/prop[@name="context"]//text())', dom)?.toString() ?? "",
                contextid: parseInt(xpath.select1('string(/map[@name="apama-response"]/map[@name="contextprogress"]/prop[@name="contextid"]//text())', dom)?.toString() ?? "0"),
                paused: xpath.select1('string(/map[@name="apama-response"]/map[@name="contextprogress"]/prop[@name="paused"]//text())', dom)?.toString() === 'true',
                owner: xpath.select1('string(/map[@name="apama-response"]/map[@name="contextprogress"]/prop[@name="owner"]//text())', dom)?.toString() ?? "",
                type: xpath.select1('string(/map[@name="apama-response"]/map[@name="contextprogress"]/prop[@name="type"]//text())', dom)?.toString() ?? "",
                action: xpath.select1('string(/map[@name="apama-response"]/map[@name="contextprogress"]/prop[@name="action"]//text())', dom)?.toString() ?? "",
                instance: parseInt(xpath.select1('string(/map[@name="apama-response"]/map[@name="contextprogress"]/prop[@name="instance"]//text())', dom)?.toString() ?? "0"),
                monitor: xpath.select1('string(/map[@name="apama-response"]/map[@name="contextprogress"]/prop[@name="monitor"]//text())', dom)?.toString() ?? "",
                filename: xpath.select1('string(/map[@name="apama-response"]/map[@name="contextprogress"]/prop[@name="filename"]//text())', dom)?.toString() ?? "",
                filehash: xpath.select1('string(/map[@name="apama-response"]/map[@name="contextprogress"]/prop[@name="filehash"]//text())', dom)?.toString() ?? "",
                reason: xpath.select1('string(/map[@name="apama-response"]/map[@name="contextprogress"]/prop[@name="reason"]//text())', dom)?.toString() ?? "",
                line: parseInt(xpath.select1('string(/map[@name="apama-response"]/map[@name="contextprogress"]/prop[@name="line"]//text())', dom)?.toString() ?? "0")
            };
            //console.log(retVal);
            return retVal;
        }
        catch(e ) {
            if (e instanceof AxiosError) {
                // If the await timed out (but not during connection) then just recreate it
                if (e.code === 'ECONNABORTED' && e.message.indexOf("timeout") >= 0 ) {
                    return this.awaitPause();
                } else {
                    console.log("await pause encounterd an error");
                    throw e;
                }
            } else {
                console.log("await pause encounterd an error");
                throw e;
            }
        }
    }

    public async getContextStatuses(): Promise<(CorrelatorContextState | CorrelatorPaused)[]> {
        console.log("getContextStatuses");


        const response = await axios.get(`${this.url}/correlator/debug/progress`);
        const dom = new DOMParser().parseFromString(response.data, 'text/xml');
        const contextStatusNodes: any[] = xpath.select('/map[@name="apama-response"]/list[@name="progress"]/map[@name="contextprogress"]', dom) as any[];

        // Have to convert back to a string and then back to dom because this xpath implementation only finds from root node
        const contextStatusStrings = contextStatusNodes.map((contextStatusNode: { toString: () => any; }) => contextStatusNode.toString());
        const doms: any[] = contextStatusStrings.map((contextStatusString: string) => new DOMParser().parseFromString(contextStatusString, 'text/xml'));
        const retVal = doms.map((dom: any) => {
                const paused = xpath.select1('string(/map/prop[@name="paused"]//text())', dom)?.toString() === 'true';
                if (paused) {
                    return {
                        context: xpath.select1('string(/map/prop[@name="context"]//text())', dom)?.toString() ?? "",
                        contextid: parseInt(xpath.select1('string(/map/prop[@name="contextid"]//text())', dom)?.toString() ?? "0"),
                        paused,
                        owner: xpath.select1('string(/map/prop[@name="owner"]//text())', dom)?.toString() ?? "",
                        type: xpath.select1('string(/map/prop[@name="type"]//text())', dom)?.toString() ?? "",
                        action: xpath.select1('string(/map/prop[@name="action"]//text())', dom)?.toString() ?? "",
                        instance: parseInt(xpath.select1('string(/map/prop[@name="instance"]//text())', dom)?.toString() ?? ""),
                        monitor: xpath.select1('string(/map/prop[@name="monitor"]//text())', dom)?.toString() ?? "",
                        filename: xpath.select1('string(/map/prop[@name="filename"]//text())', dom)?.toString() ?? "",
                        filehash: xpath.select1('string(/map/prop[@name="filehash"]//text())', dom)?.toString() ?? "",
                        reason: xpath.select1('string(/map/prop[@name="reason"]//text())', dom)?.toString() ?? "",
                        line: parseInt(xpath.select1('string(/map/prop[@name="line"]//text())', dom)?.toString() ?? "0")
                    };
                } else {
                    return {
                        context: xpath.select1('string(/map/prop[@name="context"]//text())', dom)?.toString() ?? "",
                        contextid: parseInt(xpath.select1('string(/map/prop[@name="contextid"]//text())', dom)?.toString() ?? "0"),
                        paused
                    };
                }
            });

            //console.log(retVal);
            return retVal;

    }

    public async getStackTrace(contextid: number): Promise<CorrelatorStackTrace> {
        console.log("getStackTrace");
        const response = await axios.get(`${this.url}/correlator/debug/progress/stack/id:${contextid}`);
        const dom = new DOMParser().parseFromString(response.data, 'text/xml');
        
        const stackframesResult = xpath.select('/map[@name="apama-response"]/list[@name="stack"]/map[@name="stackframe"]', dom);
        
        let stackframes: Node[];
        if (Array.isArray(stackframesResult)) {
            stackframes = stackframesResult;
        } else if (stackframesResult instanceof Node) {
            stackframes = [stackframesResult];
        } else {
            stackframes = [];
        }

        const retVal = {
            contextid: parseInt(xpath.select1('string(/map[@name="apama-response"]/list[@name="stack"]/prop[@name="contextid"]//text())', dom)?.toString() ?? '0'),
            monitor: xpath.select1('string(/map[@name="apama-response"]/list[@name="stack"]/prop[@name="monitor"]//text())', dom)?.toString() ?? '',
            stackframes: stackframes
                // Have to convert back to a string and then back to dom because this xpath implementation only finds from root node
                .map((node: Node) => node.toString())
                .map((nodeString: string) => new DOMParser().parseFromString(nodeString, 'text/xml'))
                .map((dom: Document) => ({
                    owner: xpath.select1('string(/map/prop[@name="owner"]//text())', dom)?.toString() ?? '',
                    type: xpath.select1('string(/map/prop[@name="type"]//text())', dom)?.toString() ?? '',
                    action: xpath.select1('string(/map/prop[@name="action"]//text())', dom)?.toString() ?? '',
                    lineno: parseInt(xpath.select1('string(/map/prop[@name="lineno"]//text())', dom)?.toString() ?? '0'),
                    filename: xpath.select1('string(/map/prop[@name="filename"]//text())', dom)?.toString() ?? '',
                    filehash: xpath.select1('string(/map/prop[@name="filehash"]//text())', dom)?.toString() ?? ''
                }))
        };
        
        return retVal;
    }

    public async getLocalVariables(contextid: number, frameidx: number): Promise<CorrelatorVariable[]> {
        console.log("getLocalVariables");
        const response = await axios.get(`${this.url}/correlator/debug/progress/locals/id:${contextid};${frameidx}`);
        const dom = new DOMParser().parseFromString(response.data, 'text/xml');
        const nodes = xpath.select('/map[@name="apama-response"]/list[@name="locals"]/map[@name="variable"]', dom) as Node[];
        const nodeStrings = nodes!.map((node: { toString: () => any; }) => node.toString());
        const doms = nodeStrings.map((nodeString: string) => new DOMParser().parseFromString(nodeString, 'text/xml'));
        const retVal = doms.map((dom: any) => ({
            name: xpath.select1('string(/map/prop[@name="name"]//text())', dom)?.toString() ?? "",
            type: xpath.select1('string(/map/prop[@name="type"]//text())', dom)?.toString() ?? "",
            value: xpath.select1('string(/map/prop[@name="value"]//text())', dom)?.toString() ?? ""
        }));
        //console.log(retVal);
        return retVal;
    }

    public async getMonitorVariables(contextid: number, instance: number): Promise<CorrelatorVariable[]> {
        console.log("getMonitorVariables");
        const response = await axios.get(`${this.url}/correlator/contexts/id:${contextid}/${instance}`);
        const dom = new DOMParser().parseFromString(response.data, 'text/xml');
        const nodes = xpath.select('/map[@name="apama-response"]/list[@name="mthread"]/map[@name="variable"]', dom) as Node[];
        const nodeStrings = nodes!.map((node: { toString: () => any; }) => node.toString());
        const doms = nodeStrings.map((nodeString: string) => new DOMParser().parseFromString(nodeString, 'text/xml'));
        const retVal: CorrelatorVariable[] = [];
        for (const dom of doms){
            const name = xpath.select1('string(/map/prop[@name="name"]//text())', dom)?.toString() ?? "";
            const value = await this.getMonitorVariableValue(contextid, instance, name);
            retVal.push({
                name,
                type: xpath.select1('string(/map/prop[@name="type"]//text())', dom)?.toString() ?? "",
                value
            });            
        }

        //console.log(retVal);
        return retVal; 
    }

    public async getMonitorVariableValue(contextid: number, instance: number, variableName: string): Promise<string> {
        console.log("getMonitorVariableValue");
        const response = await axios.get(`${this.url}/correlator/contexts/id:${contextid}/${instance}/${variableName}`);
        const dom = new DOMParser().parseFromString(response.data, 'text/xml');
        const retVal = xpath.select1('string(/map[@name="apama-response"]/prop[@name="value"]//text())', dom)?.toString() ?? "";
        //console.log(retVal);
        return retVal;
    }

    public async setBreakOnErrors(breakOnErrors: boolean): Promise<void> {
        console.log("setBreakOnErrors");
        const body = '<map name="apama-request"></map>';
        if (breakOnErrors) {
            return await axios.put(`${this.url}/correlator/debug/breakpoint/errors`, body);
        } else {
            return await axios.delete(`${this.url}/correlator/debug/breakpoint/errors`, { data: body });
        }
    }
}