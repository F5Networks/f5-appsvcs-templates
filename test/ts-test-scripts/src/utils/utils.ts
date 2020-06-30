module.exports = {
    getFileFromRootDir(filepath:string) {
        return require('fs').readFileSync(`${require('path').resolve(__dirname, '')}/../../${filepath}`);
    },
    decrementIp(ip:string):string {
        let ipBits = ip.split('.');
        let operatingOn = 3;
        while(+ipBits[operatingOn] - 1 === -1) {
            ipBits[operatingOn] = '9';
            operatingOn--;
        }

        ipBits[operatingOn] = (+ipBits[operatingOn] - 1).toString();
        
        return `${ipBits[0]}.${ipBits[1]}.${ipBits[2]}.${ipBits[3]}`;
    },
    async delay(ms: number) {
        return new Promise<void>( resolve => setTimeout(resolve, ms) );
    }
}