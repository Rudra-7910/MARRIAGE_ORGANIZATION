#include <iostream>
#include <string>
using namespace std;

int main() {
    int balance = 10000;
    int amount;
    for (int i = 0; i < 4; i++) {
        cout << "\nEnter withdrawal amount: Rs ";
        cin >> amount;
        try {
            if (amount > balance) {
                throw amount;
            }
            if (amount % 100 != 0 || amount <= 0) {
                throw string("Amount must be a positive multiple of 100");
            }
            balance = balance - amount;
            cout << "Withdrawal successful!" << endl;
            cout << "Remaining balance: Rs " << balance << endl;
        }
        catch (int) {
            cout << "Insufficient balance!" << endl;
        }

        catch (string message) {
            cout << message << endl;
        }

        catch (...) {
            cout << "Unexpected error!" << endl;
        }
    }

    cout << "\nFinal balance = Rs " << balance << endl;

    return 0;
}