import {exec} from "child_process";
import {Tool} from "langchain/agents";
import {singleton} from "tsyringe";

@singleton()
export class MinecraftStartTool extends Tool {
    name = 'minecraft-start';

    description = 'Starts the minecraft server. Gives back the output and the map URL. Input should be an empty string.';

    protected _call(arg: string): Promise<string> {
        return new Promise<string>((resolve) => {
            exec('/home/jannis/parmelae-bot/cmd/startminecraft', (error, stdout, stderr) => {
                if (error) {
                    resolve('Error: ' + stderr.trim());
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }
}