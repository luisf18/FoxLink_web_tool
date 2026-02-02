
// Função para converter Intel HEX em bins contínuos
function intelHexToBins(text, flashSize = null) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    let bins = [];
    let extendedAddr = 0;
    let currentBin = null;

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        if (!line.startsWith(':')) throw new Error(`Linha inválida ${lineNum+1}: ${line}`);

        const byteCount = parseInt(line.slice(1,3),16);
        const rawAddr   = parseInt(line.slice(3,7),16);
        const recType   = parseInt(line.slice(7,9),16);
        const dataField = line.slice(9, 9 + byteCount*2);

        // Extrai os bytes
        const data = [];
        for (let i=0; i<dataField.length; i+=2) {
            data.push(parseInt(dataField.slice(i,i+2),16));
        }

        if (recType === 0x04) { // Extended Linear Address
            extendedAddr = (data[0]<<8)|data[1];
            continue;
        }

        if (recType === 0x01) break; // EOF

        const fullAddr = (extendedAddr<<16) | rawAddr;

        if (flashSize && fullAddr + byteCount > flashSize) {
            throw new Error(`Endereço ${fullAddr.toString(16)} ultrapassa flash size ${flashSize.toString(16)}`);
        }

        if (!currentBin) {
            currentBin = { addr: fullAddr, data: data };
        } else {
            const lastAddr = currentBin.addr + currentBin.data.length;
            if (fullAddr === lastAddr) {
                currentBin.data.push(...data);
            } else {
                currentBin.len = currentBin.data.length;
                bins.push(currentBin);
                currentBin = { addr: fullAddr, data: data };
            }
        }
    }

    if (currentBin) {
        currentBin.len = currentBin.data.length;
        bins.push(currentBin);
    }

    return bins;
}

