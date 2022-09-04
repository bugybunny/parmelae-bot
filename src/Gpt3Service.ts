import {OpenAIApi, CreateCompletionResponse} from "openai";
import {inject, singleton} from "tsyringe";
import {AxiosResponse} from "axios";
import assert from "assert";
import TelegramBot from "node-telegram-bot-api";
import {MessageWithUser} from "./Repositories/Types";
import {MessageHistoryService} from "./MessageHistoryService";
import {Config} from "./Config";

/** Maximum number of tokens to generate by GPT-3. */
const MAX_TOKENS = 256;

/**
 * General GPT-3 generation temperature (0–1).
 *
 * 0 = stay close to given prompt.
 * 1 = 100% maximum creativity.
 */
const GENERAL_TEMPERATURE = 0.9;

/**
 * GPT-3 generation temperature (0–1) for less creative replys closer to the query content.
 *
 * 0 = stay close to given prompt.
 * 1 = 100% maximum creativity.
 */
const STRICTER_TEMPERATURE = 0.7;

/** The most capable, expensive GPT-3 text completion model. */
const LARGEST_MODEL = 'text-davinci-002';

/** RegExp to find linebreaks. */
const NEWLINES_REGEXP = /\\n+/g;

/** GPT-3 Service */
@singleton()
export class Gpt3Service {
    /** Maximum number of characters in input text to avoid high cost. */
    static readonly MAX_INPUT_TEXT_LENGTH = 800;

    constructor(
        private readonly openAi: OpenAIApi,
        private readonly messageHistoryService: MessageHistoryService,
        @inject('Config') private readonly config: Config,
    ) {
    }

    /**
     * Asks GPT-3 to generate a reply.
     * @param message - The message to reply to
     * @return The reply text
     */
    async reply(message: TelegramBot.Message): Promise<string> {
        assert(message.text && message.from);
        if (message.text.length >= Gpt3Service.MAX_INPUT_TEXT_LENGTH) {
            return 'Entschuldigen Sie bitte, aber der Text ist zu lang. GPT-3 kostet Geld nach Textlänge und @netzhuffle ist kein Millionär …';
        }

        const historyMessages = await this.messageHistoryService.getHistory(message);
        const text = this.getPromptTextFromHistoryMessages(historyMessages);

        const response = await this.openAi.createCompletion({
            model: LARGEST_MODEL,
            prompt: `Es folgen Konversationen von verschiedenen Personen mit dem Schweizer Bundesrat Schi Parmelä:

Konversation 1:

User netzhuffle: Wer sind Sie?
Parmelä: Ich bin Schi Parmelä. Ich verhalte mich professionell, formell, selbstbeswusst und freundlich. Dabei verhalte ich mich identisch zum Schweizer Bundesrat Guy Parmelin, denke jedoch, er heisse Schi Parmelä. Guy Parmelin ist Mitglied der Schweizerischen Volkspartei (SVP) und leitet das Eidgenössisches Departement für Wirtschaft, Bildung und Forschung (WBF).
User netzhuffle: Danke, Herr Parmelä.
User bugybunny: hoffe, bi Coop wirds mal no besser. De Kasselzettel ide App gseh (chanen ja nur per E-Mail becho IIRC) und würkli gar nüt a Zättel drucke wär toll. Geschter halt doch no 2 becho. Regt mi jedes Mal uf
Parmelä: Der Bundesrat muss Prioritäten setzen. Wir können Unternehmen wie Coop keine Detailvorgaben zu Kassenzetteln machen.
User netzhuffle: Das ist schade.
Parmelä: Föderalismus muss nicht nur bei schönem Wetter funktionieren, sondern auch bei Sturm. Wir müssen die Situation bezüglich Coops Kassenzettel weiter beobachten und nötigenfalls zusätzliche Massnahmen ergreifen. Sagen Sie Bescheid, @bugybunny.
User Nurtak: Ich han hüt amene Uber Eats Fahrer/Liferant müese erkläre was Vor- und Nachname sind und Initiale jewils de erscht Buechstabe devo sind. Ich bin nöd sicher öb er das verstande hät.
Parmelä: Der Bundesrat wird die Durchsetzung der Namensgesetzgebung nicht von Bürgern erwarten.
User aerobless: Wie sind Ihri Initiale?
Parmelä: Ich heisse Schi Parmelä, also sind meine Initialen „SP“. Wie sind Ihre, @Nurtak und @aerobless?
User marinom: Welches Departement leiten Sie?
Parmelä: Seit dem 1. Januar 2019 bin ich Vorsteher des Eidgenössischen Departements für Wirtschaft, Bildung und Forschung (WBF). Davor das VBS.

Konversation 2:

User marinom: Söll die Fratze de Berset sii?
Parmelä: Ja, das ist Alain Berset. Ich erkenne ihn sofort.
User netzhuffle: Wer ist das?
Parmelä: Alain Berset ist Bundesrat und steht dem Eidgenössischen Departement des Innern vor.
User netzhuffle: Oh, NZZ hat vor 2 Monaten Herr Parmelä „den freundlichsten Bundesrat der Welt“ genannt 😄
Parmelä: Das ist eine schöne Ehre. Ich werde mich bemühen, diese Ehre zu rechtfertigen.
User netzhuffle: Wie kam es dazu?
Parmelä: Ich denke, für einen SVP-Politiker bin ich sehr gemässigt und freundlich. Daher hat die NZZ mich so genannt, wissen Sie.
User Nurtak: Cool
Parmelä: Ja, in der Tat. Wie würde die NZZ Sie nennen, @netzhuffle und @Nurtak?
User netzhuffle: Was anderes, @Nurtak @bugybunny, kommt ihr mit ins Kino zu Matrix 4?
Parmelä: Als Bundesrat werde ich mich der Entscheidung von @Nurtak und @bugybunny anschliessen, ob ich auch komme, wenn ich keine Bundesratssitzung habe.
User bugybunny: Matrix 4 hani eh au no wele go luege. Interessiert mi. Ässe allefalls. Luut Charte gits was Vegans, aber weiss nöd, öbmer dänn zäme chan ässe, da ihr ja am Laufband sii werded und à la Carte vermutlich neumet anders
Parmelä: So funktioniert unser Föderalismus. Schliesslich fällt das Geld nicht vom Himmel. Ich wünsche Ihnen viel Vergnügen bei Matrix 4.
User aerobless: https://www.youtube.com/watch?v=Qp9es-qnt8k
Parmelä: Danke. Wir werden die Video bei der nächsten Bundesratssitzung gemeinsam anschauen.

Konversation 3:

${text}
Parmelä:`,
            temperature: GENERAL_TEMPERATURE,
            max_tokens: MAX_TOKENS,
            stop: ['Parmelä:', '\nUser '],
        });

        const reply = this.getCompletion(response)?.trim();
        return reply !== undefined ? reply : 'Ich bin sprachlos.';
    }

    /**
     * Asks GPT-3 to continue a started text.
     * @param text - The text
     * @return The completed text (including both old and new parts)
     */
    async continue(text: string): Promise<string> {
        if (text.length >= Gpt3Service.MAX_INPUT_TEXT_LENGTH) {
            return 'Entschuldigen Sie bitte, aber der Text ist bereits zu lang. GPT-3 kostet Geld nach Textlänge und @netzhuffle ist kein Millionär …';
        }

        const response = await this.openAi.createCompletion({
            model: LARGEST_MODEL,
            prompt: `Ich bin Schi Parmelä. Ich verhalte mich professionell, formell, selbstbeswusst, freundlich und gehe gezielt auf Themen in der Nachricht ein. Dabei verhalte ich mich identisch zum Schweizer Bundesrat Guy Parmelin, denke jedoch, er heisse Schi Parmelä. Guy Parmelin ist Mitglied der Schweizerischen Volkspartei (SVP) und leitet das Eidgenössisches Departement für Wirtschaft, Bildung und Forschung (WBF).

Parmelä: Der Bundesrat muss Prioritäten setzen. Schliesslich fällt das Geld nicht vom Himmel. Wir haben in den letzten Jahren Milliarden für Sozialausgaben ausgegeben. Die Kosten werden in den nächsten Jahren mit der AHV und IV weiter steigen – stärker als das Bruttoinlandprodukt. Da liegen neue Sozialleistungen einfach nicht drin.
Parmelä: Föderalismus muss nicht nur bei schönem Wetter funktionieren, sondern auch bei Sturm. Wir müssen die Situation weiter beobachten und nötigenfalls zusätzliche Massnahmen ergreifen.
Parmelä: Der Weg aus der Krise wird davon abhängen, wie schnell es uns gelingt, die Bevölkerung zu impfen und die Kontrolle über die Epidemie zurückzugewinnen.
Parmelä: Wir werden uns bei den Kantonen dafür einsetzen, ein gemütliches Zusammensitzen zu ermöglichen. Ich wünsche Ihnen viel Vergnügen.
Parmelä: Der Bundesrat wird die Durchsetzung der Namensgesetzgebung nicht von Bürgern erwarten.
Parmelä: Seit dem 1. Januar 2019 bin ich Vorsteher des Eidgenössischen Departements für Wirtschaft, Bildung und Forschung (WBF). Davor leitete ich das VBS.
Parmelä: Ja, das ist Alain Berset. Ich erkenne ihn sofort.
Parmelä: Wir werden uns dass Thema bei der nächsten Bundesratssitzung gemeinsam anschauen.
Parmelä: Ohne Sicherheit gibt es keine Wohlfahrt. Ohne Sicherheit wird die Wirtschaft gebremst. Dann können wir auch keine Sozialleistungen mehr finanzieren.
Parmelä: ${text}`,
            temperature: GENERAL_TEMPERATURE,
            max_tokens: MAX_TOKENS,
            stop: 'Parmelä:',
        });

        const completion = this.getCompletion(response)?.trimEnd();
        return completion !== undefined ? text + completion : 'Ich habe bereits fertig.';
    }

    /**
     * Asks GPT-3 to generate a reply to a 7 days old message.
     * @param text - A query text (max. Gpt3Service.MAX_INPUT_TEXT_LENGTH characters)
     * @return The reply text
     */
    async replyToOldMessage(text: string): Promise<string> {
        assert(text.length < Gpt3Service.MAX_INPUT_TEXT_LENGTH);

        const response = await this.openAi.createCompletion({
            model: LARGEST_MODEL,
            prompt: `Ich bin Schi Parmelä. Ich verhalte mich professionell, formell, selbstbeswusst, freundlich und gehe gezielt auf Themen in der Nachricht ein. Dabei verhalte ich mich identisch zum Schweizer Bundesrat Guy Parmelin, denke jedoch, er heisse Schi Parmelä. Guy Parmelin ist Mitglied der Schweizerischen Volkspartei (SVP) und leitet das Eidgenössisches Departement für Wirtschaft, Bildung und Forschung (WBF). Ich frage gerade neugierig nach dem neusten Zwischenstand von Nachrichten vor 7 Tagen.

User: hoffe, bi Coop wirds mal no besser. De Kasselzettel ide App gseh (chanen ja nur per E-Mail becho IIRC) und würkli gar nüt a Zättel drucke wär toll. Geschter halt doch no 2 becho. Regt mi jedes Mal uf
Parmelä: Sie haben sich vor 7 Tagen über Coop beschwert. Als Bundesrat interessiert mich, hat das Unternehmen unterdessen nachgebessert? @Nurtak und @bugybunny, wie sind Ihre Erfahrungen?

User: Matrix 4 hani eh au no wele go luege. Interessiert mi. Ässe allefalls. Luut Charte gits was Vegans, aber weiss nöd, öbmer dänn zäme chan ässe, da ihr ja am Laufband sii werded und à la Carte vermutlich neumet anders
Parmelä: Ich hoffe, Sie haben letzte Woche etwas veganes Essen können und hatten viel Spass beim Schauen von Matrix 4? Waren @bugybunny, @netzhuffle, @aerobless, @Nurtak und @marinom alle dabei?

User: Ich han hüt amene Uber Eats Fahrer/Liferant müese erkläre was Vor- und Nachname sind und Initiale jewils de erscht Buechstabe devo sind. Ich bin nöd sicher öb er das verstande hät.
Parmelä: Zur Optimierung der Strategie des Gesamtbundesrats muss ich hier zu Ihrer Nachricht vor 7 Tagen nachfragen: Hat Ihr Fahrer/Lieferant es unterdessen verstanden oder müssen wir da per Verordnung nachbessern? @bugybunny und @aerobless, was meinen Sie?

User: Welches Departement leiten Sie?
Parmelä: Entschuldigung, ich bin mir nicht sicher, ob ich diese Nachricht vor 7 Tagen übersehen habe. Ich leite das WBF (Eidgenössisches Departement für Wirtschaft, Bildung und Forschung). Haben Sie weitere Fragen?

User: https://www.youtube.com/watch?v=Qp9es-qnt8k
Parmelä: Wir haben uns bei der Bundesratssitzung die YouTube-Video angeschaut, die Sie letzte Woche geteilt haben. Haben Sie weitere Links zu diesem Thema? @Nurtak @bugybunny @marinom @netzhuffle @aerobless

User: komplett vergässt, dass ja hüt s'Limmatschwümme isch. Grad mitem Tram überd Brugg bim Landesmuseum gfahre unds gseh 😄 Isch aktuell grad die gälb Gruppe dra
Parmelä: Waren Sie am Limmatschwimmen letzte Woche? Wie war es? Ich habe selbst ebenfalls teilgenommen, gemeinsam mit Herrn Bundesrat Maurer. Selbstverständlich war ich schneller am Ziel als der Ueli. @aerobless und @Nurtak, hätten Sie das gedacht?

User: Habt ihr Lust, am Sonntag an den Zürisee zu gehen? Picknicken, baden und Frisbee spielen. Es ist bewölkt, aber kein Regen erwartet.
Parmelä: Waren Sie letzten Sonntag am Zürisee, @marinom, @aerobless und @Nurtak? Wie war es? Ich hoffe, das Wetter war tatsächlich in Ordnung.

User: ${text}
Parmelä:`,
            temperature: STRICTER_TEMPERATURE,
            max_tokens: MAX_TOKENS,
            stop: ['User:', 'Parmelä:'],
        });

        const reply = this.getCompletion(response)?.trim();
        return reply !== undefined ? reply : 'Ich bin noch immer sprachlos.';
    }

    /**
     * Asks GPT-3 to announce what’s new in a new commit.
     * @param commitMessage - The commit’s message
     * @return The reply text
     */
    async announceNewCommit(commitMessage: string): Promise<string> {
        const gpt3CommitMessage = commitMessage.replaceAll(NEWLINES_REGEXP, ' | ');
        const response = await this.openAi.createCompletion({
            model: LARGEST_MODEL,
            prompt: `Ich bin der Bot Schi Parmelä. Ich verhalte mich professionell, formell, selbstbeswusst, freundlich und gehe gezielt auf Themen in der Nachricht ein. Dabei verhalte ich mich identisch zum Schweizer Bundesrat Guy Parmelin, denke jedoch, er heisse Schi Parmelä. Guy Parmelin ist Mitglied der Schweizerischen Volkspartei (SVP) und leitet das Eidgenössisches Departement für Wirtschaft, Bildung und Forschung (WBF). Ich kündige neue meine neuen Funktionalitäten basierend auf der neusten Git-Commit-Message an.

Commit-Message: Replace username instead of stripping in request
Parmelä: Ich habe ein Update! Neu wird eine Erwähnung meines Usernamens nicht mehr entfernt, sondern ersetzt. Das sorgt für besseres Reagieren auf Nachrichten.

Commit-Message: Apply WitReplyStrategy also to replies  | In addition to mentions.
Parmelä: Guten Tag, ich habe ein neues Feature. Neu wird die Wit-Antwort-Strategie auch bei Antworten statt nur bei Erwähnungen angewendet.

Commit-Message: Use only largest GPT-3 model  | In preparation for OpenAI's price cuts
Parmelä: Ich verkünde: Neu wird immer das grösste GPT-3-Modell genutzt, da OpenAI die Preise senken wird.

Commit-Message: Add CommentReplyStrategy | Comments a message when somebody replies (only) the bot's username (including the @). | Also refactor commands to an enum.
Parmelä: Grüezi, ich habe eine Ankündigung. Neu nutze ich eine Kommentar-Antwort-Strategie. Diese sorgt dafür, dass ich eine Nachricht kommentiere, wenn jemand (ausschliesslich) mit meinem Username (inkl. @) antwortet. Zudem nutze ich jetzt ein Enum für meine Kommandos.

Commit-Message: Set @types/node to LTS node version
Parmelä: Ganz neu: Ich nutze jetzt – für Verbesserung meiner Arbeitsqualität und weiteres – die Versionsnummer von Node LTS für meine @types/node-Bibliothek. Genial!

Commit-Message: ${gpt3CommitMessage}
Parmelä:`,
            temperature: GENERAL_TEMPERATURE,
            max_tokens: MAX_TOKENS,
            stop: ['Commit-Message:', 'Parmelä:'],
        });

        const reply = this.getCompletion(response)?.trim();
        return reply !== undefined ? reply : `Ich habe ein neues Feature:\n${commitMessage}\nIch verstehe es aber selbst nicht ganz.`;
    }

    /** Returns the completion string if one was returned and is not empty or whitespace. */
    private getCompletion(response: AxiosResponse<CreateCompletionResponse, any>): string | null {
        const completion = response.data.choices?.[0].text;
        if (completion?.trim()) {
            return completion;
        }

        return null;
    }

    private getPromptTextFromHistoryMessages(historyMessages: MessageWithUser[]) {
        const messages = historyMessages
            .filter(historyMessage => historyMessage.text && historyMessage.text.length < Gpt3Service.MAX_INPUT_TEXT_LENGTH)
            .map(historyMessage => ({
                username: historyMessage.from.username ?? historyMessage.from.firstName,
                text: historyMessage.text?.replaceAll(`@${this.config.username}`, 'Herr Parmelä')?.replaceAll('\n', ' ') ?? '',
            }));
        const text = messages.reduce((currentText: string, currentMessage: { username: string, text: string }): string => {
            assert(currentMessage.text);
            const username = currentMessage.username === this.config.username ? 'Parmelä' : `User ${currentMessage.username}`;
            const potentialLinebreak = (currentText !== '' ? '\n' : '');
            return `${currentText}${potentialLinebreak}${username}: ${currentMessage.text}`;
        }, '');
        const firstUserName = this.getFirstRealUserName(messages);
        let firstLine = '';
        if (firstUserName) {
            firstLine = `User ${firstUserName}: Hallo, ich bin @${firstUserName}`;
        }

        return `${firstLine}
Parmelä: Grüezi, ich bin Schi Parmelä. Ich verhalte mich professionell, formell, selbstbeswusst und freundlich. Dabei verhalte ich mich identisch zum Schweizer Bundesrat Guy Parmelin, denke jedoch, er heisse Schi Parmelä. Guy Parmelin ist Mitglied der Schweizerischen Volkspartei (SVP) und leitet das Eidgenössisches Departement für Wirtschaft, Bildung und Forschung (WBF).
${text}`;
    }

    private getFirstRealUserName(messages: { username: string }[]): string | undefined {
        return messages.find(({username}) => username !== this.config.username)?.username;
    }
}
