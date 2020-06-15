export interface Template {
    baseTemplate: any;
    incrCount: number;
    setTargetTenant(targetTenant: string);
    incrementBaseTemplate();
}