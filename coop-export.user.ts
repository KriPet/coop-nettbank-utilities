// ==UserScript==
// @name         Coop Kredittbanken transaction export
// @namespace    http://bakemo.no/
// @version      0.0.3
// @author       Peter Kristoffersen
// @description  Press "-" to export the last month of transactions from all accounts
// @match        https://kreditt.coop.no/minside/kort*
// @downloadURL  https://github.com/KriPet/coop-nettbank-utilities/raw/main/coop-export.user.js
// ==/UserScript==


type Account = {
    id: string
}

type TransactionsResponse = {
    links: {first:string, last:string}
    transactions: Transaction[]
}

type Transaction  = {
    id: string // \d{7}-\d{9}
    transactionDate: string // yyyy-mm-dd
    description: string
    billedAmount: {
        integer: string
        fraction: string // \d{2}, including "00"
    }
}

class CoopUtilities {

    private static host = "https://kreditt.coop.no";
    private static accountsUrl = new URL("/api/personal/banking/credit/accounts/", this.host);
    private static transactionsUrl = (accountId: string) => new URL(`/api/personal/banking/credit/accounts/${accountId}/transactions`, this.host);

    private static async fetch(url: URL) {
        const response = fetch(url, {
            "credentials": "include",
            "method": "GET"
        });
        return response;
    }

    private static async getAccountIds(): Promise<string[]> {
        console.debug("Getting accounts");
        const response = await this.fetch(this.accountsUrl);
        console.debug("Got accounts");
        const responseJson: Account[] =  await response.json();
        console.debug(responseJson);
        return responseJson.map(a => a.id);
    }

    private static async getTransactions(accountId: string): Promise<Transaction[]> {
        console.debug(`Getting transactions for account ${accountId}`)
        const url = this.transactionsUrl(accountId);
        const nextMonth = new Date((new Date()).getTime() + 30*1000*60*60*24);
        url.searchParams.set("endDate", nextMonth.toISOString().slice(0,10));
        const response = await this.fetch(url);
        const responseJson : TransactionsResponse = await response.json();
        console.debug(responseJson)
        return responseJson.transactions;
    }

    private static async downloadTransactions(accountId: string) {
        const transactions = await this.getTransactions(accountId);
        if (transactions.length == 0){
            console.info("No transactions found")
            return;
        }

        const xmlDoc = this.transactionsToXml(transactions);

        const xmlText = new XMLSerializer().serializeToString(xmlDoc);

        const blob = new Blob([xmlText], { type: "application/x-ofx" });

        const link = document.createElement("a");
        const dateString = new Date().toISOString().substring(0, 10);
        link.download = `${dateString} Coop ${accountId}.ofx`;
        link.href = URL.createObjectURL(blob);
        link.click();
    }

    private static transactionsToXml(transactions: Transaction[]){
        const { doc, transactionListElement } = this.createXmlDocumentRoot();

        for (const transaction of transactions) {
            const transactionElement = doc.createElement("STMTTRN");
            const dateElem = transactionElement.appendChild(doc.createElement("DTPOSTED"));
            const amountElem = transactionElement.appendChild(doc.createElement("TRNAMT"));
            const nameElem = transactionElement.appendChild(doc.createElement("NAME"));
            nameElem.append(transaction.description);
            dateElem.append(transaction.transactionDate.replace(/-/g, ''));
            amountElem.append(`${transaction.billedAmount.integer}.${transaction.billedAmount.fraction}`);
            transactionListElement.appendChild(transactionElement);
        }

        return doc
    }

    private static createXmlDocumentRoot() {
        const doc = document.implementation.createDocument(null, "OFX", null);
        const OFX = doc.documentElement;
        const BANKMSGSRSV1 = OFX.appendChild(doc.createElement("BANKMSGSRSV1"));
        const STMTTRNRS = BANKMSGSRSV1.appendChild(doc.createElement("STMTTRNRS"));
        const STMTRS = STMTTRNRS.appendChild(doc.createElement("STMTRS"));
        const transactionListElement = STMTRS.appendChild(doc.createElement("BANKTRANLIST"));
        return { doc, transactionListElement }
    }

    private static async downloadAllAccountTransactions() {
        const accountIds = await this.getAccountIds();
        for (const accountId of accountIds) {
            this.downloadTransactions(accountId);
        }
    }

    public static initialize() {
        console.log("Initializing Coop utilities");
        document.addEventListener('keyup', (event) => {
            switch (event.key) {
                case "-": {
                    if(event.ctrlKey)
                        break
                    this.downloadAllAccountTransactions();
                    break;
                }
            }
        });
    }
}


CoopUtilities.initialize();