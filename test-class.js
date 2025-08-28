class TestClass {
    constructor() {
        this.value = 0;
    }

    mainMethod() {
        console.log("Starting main method");
        this.helperMethod1();
        this.helperMethod2();
        const result = this.calculateResult();
        console.log("Result:", result);
        return result;
    }
    
    helperMethod1() {
        console.log("Helper 1");
        this.value += 10;
    }
    
    helperMethod2() {
        console.log("Helper 2");
        this.value += 20;
    }
    
    calculateResult() {
        console.log("Calculating...");
        return this.value * 2;
    }
}

// Test function
function runTest() {
    const test = new TestClass();
    const result = test.mainMethod();
    console.log("Final result:", result);
}

runTest();
