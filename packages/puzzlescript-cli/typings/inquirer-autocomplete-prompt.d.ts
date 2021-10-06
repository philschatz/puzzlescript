// TypeScript definition for the package
declare module 'inquirer-autocomplete-prompt' {

    // This is hacky and I don't know what it does but I got rid of compiler errors.

    import r from 'readline'

    interface Answers extends Record<string, any> {}
    type LiteralUnion<T extends F, F = string> = T | (F & {});
    type PromptState = LiteralUnion<'pending' | 'idle' | 'loading' | 'answered' | 'done'>;
    interface PromptBase {
        status: PromptState;
        run(): Promise<any>;
    }
    interface PromptConstructor {
        new (question: any, readLine: r.Interface, answers: Answers): PromptBase;
    }

    import {PromptModule} from 'inquirer'

    const x: PromptConstructor
    export = x;
}

