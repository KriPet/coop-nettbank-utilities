"use strict";
// ==UserScript==
// @name         Coop Kredittbanken transaction export
// @namespace    http://bakemo.no/
// @version      0.0.1
// @author       Peter Kristoffersen
// @description  Press "-" to export the last month of transactions from all accounts
// @match        https://kreditt.coop.no/minside/kort*
// ==/UserScript==
class CoopUtilities {
    static host = "https://kreditt.coop.no";
    static accountsUrl = new URL("/api/personal/banking/credit/accounts/", this.host);
    static transactionsUrl = (accountId) => new URL(`/api/personal/banking/credit/accounts/${accountId}/transactions`, this.host);
    static fetch(url) {
        return fetch(url, {
            "credentials": "include",
            "method": "GET"
        });
    }
    static async getAccountIds() {
        console.debug("Getting accounts");
        const response = await this.fetch(this.accountsUrl);
        console.debug("Got accounts");
        const responseJson = await response.json();
        console.debug(responseJson);
        return responseJson.map(a => a.id);
    }
    static async getTransactions(accountId) {
        console.debug(`Getting transactions for account ${accountId}`);
        const url = this.transactionsUrl(accountId);
        const response = await this.fetch(url);
        const responseJson = await response.json();
        console.debug(responseJson);
        return responseJson.transactions;
    }
    static async downloadTransactions(accountId) {
        const transactions = await this.getTransactions(accountId);
        if (transactions.length == 0) {
            console.info("No transactions found");
            return;
        }
        const { doc, transactionListElement } = this.createXmlDocument();
        for (const transaction of transactions) {
            const transactionElement = doc.createElement("STMTTRN");
            const dateElem = transactionElement.appendChild(doc.createElement("DTPOSTED"));
            const amountElem = transactionElement.appendChild(doc.createElement("TRNAMT"));
            const nameElem = transactionElement.appendChild(doc.createElement("NAME"));
            nameElem.append(transaction.description);
            dateElem.append(transaction.transactionDate.replace(/-/g, ''));
            amountElem.append(`-${transaction.transactionAmount.integer}.${transaction.transactionAmount.fraction}`);
            transactionListElement.appendChild(transactionElement);
        }
        const xmlText = new XMLSerializer().serializeToString(doc);
        const blob = new Blob([xmlText], { type: "application/x-ofx" });
        const link = document.createElement("a");
        const dateString = new Date().toISOString().substring(0, 10);
        link.download = `${dateString} Coop ${accountId}.ofx`;
        link.href = URL.createObjectURL(blob);
        link.click();
    }
    static createXmlDocument() {
        const doc = document.implementation.createDocument(null, "OFX", null);
        const OFX = doc.documentElement;
        const BANKMSGSRSV1 = OFX.appendChild(doc.createElement("BANKMSGSRSV1"));
        const STMTTRNRS = BANKMSGSRSV1.appendChild(doc.createElement("STMTTRNRS"));
        const STMTRS = STMTTRNRS.appendChild(doc.createElement("STMTRS"));
        const transactionListElement = STMTRS.appendChild(doc.createElement("BANKTRANLIST"));
        return { doc, transactionListElement };
    }
    static async downloadAllAccountTransactions() {
        const accountIds = await this.getAccountIds();
        for (const accountId of accountIds) {
            this.downloadTransactions(accountId);
        }
    }
    static initialize() {
        console.log("Initializing Coop utilities");
        document.addEventListener('keyup', (event) => {
            switch (event.key) {
                case "-": {
                    if (event.ctrlKey)
                        break;
                    this.downloadAllAccountTransactions();
                    break;
                }
            }
        });
    }
}
CoopUtilities.initialize();
