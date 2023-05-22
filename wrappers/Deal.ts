import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from 'ton-core';
import { convertUUID, parseUUID } from './utils/convertUUID';

export type DealConfig = {
    external_id: bigint;
};

export function dealConfigToCell(config: DealConfig): Cell {
    return beginCell().storeUint(config.external_id, 128).endCell();
}

export const Status = {
    created: 0,
    ready_to_start: 1,
    in_progress: 2,
    on_review: 3,
    canceled: 4,
    dispute: 5,
    done: 6,
};

export const Opcodes = {
    start: 0x392ab70e,
    ready_for_review: 0x4636db68,
    destroy: 0x10d60a76,
};

export class Deal implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Deal(address);
    }

    static createFromConfig(config: DealConfig, code: Cell, workchain = 0) {
        const data = dealConfigToCell(config);
        const init = { code, data };
        return new Deal(contractAddress(workchain, init), init);
    }

    static createFromExternalUUID(uuid: string, code: Cell, workchain = 0) {
        return Deal.createFromConfig({ external_id: convertUUID(uuid) }, code, workchain);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        return this.sendMoney(provider, via, value);
    }

    async sendMoney(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
        });
    }

    async sendStart(provider: ContractProvider, via: Sender, opts: { value: bigint; queryID?: number }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.start, 32)
                .storeUint(opts.queryID ?? 0, 64)
                .endCell(),
        });
    }

    async sendDestroy(provider: ContractProvider, via: Sender, opts: { value: bigint; queryID?: number }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.destroy, 32)
                .storeUint(opts.queryID ?? 0, 64)
                .endCell(),
        });
    }

    // async sendStartMessage(
    //     provider: ContractProvider,
    //     via: Sender,
    //     opts: {
    //         value: bigint;
    //         queryID?: number;
    //     }
    // ) {
    //     await provider.internal(via, {
    //         value: opts.value,
    //         sendMode: SendMode.PAY_GAS_SEPARATELY,
    //         body: beginCell()
    //             .storeUint(Opcodes.start, 32)
    //             .storeUint(opts.queryID ?? 0, 64)
    //             .storeUint(opts.increaseBy, 32)
    //             .endCell(),
    //     });
    // }

    async getBalance(provider: ContractProvider) {
        return (await provider.getState()).balance;
    }

    async getStatus(provider: ContractProvider) {
        const result = await provider.get('get_status', []);
        return result.stack.readNumber();
    }

    async getExternalUUID(provider: ContractProvider) {
        const result = await provider.get('get_external_id', []);
        return parseUUID(result.stack.readBigNumber());
    }
}
