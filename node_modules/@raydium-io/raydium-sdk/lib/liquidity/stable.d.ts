import { Structure } from '../marshmallow/index.js';
import * as bn_js from 'bn.js';
import { PublicKey } from '@solana/web3.js';
import '../marshmallow/buffer-layout.js';

declare const ModelDataPubkey: PublicKey;
declare const DataElement: Structure<bn_js, "", {
    x: bn_js;
    y: bn_js;
    price: bn_js;
}>;
declare const ModelDataInfo: Structure<bn_js | {
    x: bn_js;
    y: bn_js;
    price: bn_js;
}[], "", {
    status: bn_js;
    accountType: bn_js;
    multiplier: bn_js;
    validDataCount: bn_js;
    DataElement: {
        x: bn_js;
        y: bn_js;
        price: bn_js;
    }[];
}>;
interface stableModelLayout {
    accountType: number;
    status: number;
    multiplier: number;
    validDataCount: number;
    DataElement: {
        x: number;
        y: number;
        price: number;
    }[];
}
declare function getDyByDxBaseIn(layoutData: stableModelLayout, xReal: number, yReal: number, dxReal: number): number;
declare function getDxByDyBaseIn(layoutData: stableModelLayout, xReal: number, yReal: number, dyReal: number): number;
declare function formatLayout(buffer: Buffer): stableModelLayout;
declare function getStablePrice(layoutData: stableModelLayout, coinReal: number, pcReal: number, baseCoin: boolean): number;

export { DataElement, ModelDataInfo, ModelDataPubkey, formatLayout, getDxByDyBaseIn, getDyByDxBaseIn, getStablePrice, stableModelLayout };
