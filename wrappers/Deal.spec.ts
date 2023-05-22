import { Blockchain, SandboxContract, TreasuryContract } from '@ton-community/sandbox';
import { compile } from '@ton-community/blueprint';
import { Cell, fromNano, toNano } from 'ton-core';
import { Deal, Status } from './Deal';
import { Processor } from './Processor';
import { convertUUID } from './utils/convertUUID';
import '@ton-community/test-utils';

describe('Deal', () => {
    let dealCode: Cell;
    let processorCode: Cell;

    beforeAll(async () => {
        dealCode = await compile('Deal');
        processorCode = await compile('Processor');
    });

    let blockchain: Blockchain;
    let processor: SandboxContract<Processor>;
    let deal: SandboxContract<Deal>;
    let executor: SandboxContract<TreasuryContract>;
    let beneficiary: SandboxContract<TreasuryContract>;
    let admin: SandboxContract<TreasuryContract>;
    let externalUUID = 'aa901d81-07be-4459-818c-74cea8a67e78';

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        executor = await blockchain.treasury('executor');
        beneficiary = await blockchain.treasury('beneficiary');
        admin = await blockchain.treasury('admin');
    });

    beforeEach(async () => {
        processor = blockchain.openContract(
            Processor.createFromConfig({ admin_address: admin.address }, processorCode)
        );

        const deployResult = await processor.sendDeploy(admin.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: admin.address,
            to: processor.address,
            deploy: true,
            success: true,
        });
    });

    beforeEach(async () => {
        deal = blockchain.openContract(
            Deal.createFromConfig(
                {
                    external_id: convertUUID(externalUUID),
                    status: Status.created,
                    value: toNano('10.00'),
                    processor_address: processor.address,
                    executor_address: executor.address,
                    beneficiary_address: beneficiary.address,
                },
                dealCode
            )
        );

        const deployResult = await deal.sendDeploy(executor.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: executor.address,
            to: deal.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and Deal are ready to use
    });

    it('should return correct external uuid', async () => {
        const result = await deal.getExternalUUID();
        expect(result).toBe(externalUUID);
    });

    it('should not switch status if top-up was with small amounts', async () => {
        const sendMoneyResult = await deal.sendMoney(beneficiary.getSender(), toNano('1.00'));

        expect(sendMoneyResult.transactions).toHaveTransaction({
            from: beneficiary.address,
            to: deal.address,
            success: true,
        });

        const status = await deal.getStatus();

        expect(status).toBe(Status.created);
    });

    it('should switch status if top-up has made with enough amount', async () => {
        const sendMoneyResult = await deal.sendMoney(beneficiary.getSender(), toNano('10.00'));

        expect(sendMoneyResult.transactions).toHaveTransaction({
            from: beneficiary.address,
            to: deal.address,
            success: true,
        });

        const status = await deal.getStatus();

        expect(status).toBe(Status.ready_to_start);
    });

    it('should destroy and return money to executor', async () => {
        const sendDestroyResult = await deal.sendDestroy(executor.getSender(), { value: toNano('0.025') });

        expect(sendDestroyResult.transactions).toHaveTransaction({
            from: executor.address,
            to: deal.address,
            success: true,
        });
        expect(sendDestroyResult.transactions).toHaveTransaction({
            from: deal.address,
            to: executor.address,
            success: true,
        });

        const balance = await deal.getBalance();
        expect(fromNano(balance)).toBe('0');
    });

    describe('when deal has enough money', () => {
        beforeEach(async () => {
            const sendMoneyResult = await deal.sendMoney(beneficiary.getSender(), toNano('10.00'));

            expect(sendMoneyResult.transactions).toHaveTransaction({
                from: beneficiary.address,
                to: deal.address,
                success: true,
            });

            const status = await deal.getStatus();

            expect(status).toBe(Status.ready_to_start);
        });

        it('should start deal and transfer fixed fees by start message', async () => {
            const sendStartResult = await deal.sendStart(executor.getSender(), { value: toNano('0.025') });

            expect(sendStartResult.transactions).toHaveTransaction({
                from: executor.address,
                to: deal.address,
                success: true,
            });

            expect(sendStartResult.transactions).toHaveTransaction({
                from: deal.address,
                to: processor.address,
                value: toNano(1),
                success: true,
            });

            const status = await deal.getStatus();

            expect(status).toBe(Status.in_progress);
        });
    });

    // it('should able to top-up multiple times', async () => {
    //     const topUpTimes = 3;
    //     for (let i = 0; i < topUpTimes; i++) {
    //         console.log(`top-up ${i + 1}/${topUpTimes}`);

    //         const balanceBefore = await deal.getBalance();
    //         // const statusBefore = await deal.getStatus();

    //         console.log('balance before increasing', fromNano(balanceBefore));
    //         // console.log('status before increasing', statusBefore);

    //         const increaseBy = Math.floor(Math.random() * 100);

    //         console.log('increasing by', increaseBy);

    //         const increaseResult = await deal.sendMoney(beneficiary.getSender(), {
    //             value: toNano(increaseBy),
    //         });

    //         expect(increaseResult.transactions).toHaveTransaction({
    //             from: beneficiary.address,
    //             to: deal.address,
    //             success: true,
    //         });

    //         const balanceAfter = await deal.getBalance();
    //         // // const statusAfter = await deal.getStatus();

    //         console.log('balance after increasing', fromNano(balanceAfter));
    //         // // console.log('status after increasing', balanceAfter);

    //         // expect(balanceAfter).toBe(balanceBefore + toNano('20.00'));
    //     }
    // });
});
