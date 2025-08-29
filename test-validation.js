// Test file for validation system
function testFunction() {
  const data = "hello world";
  return data.toUpperCase();
}

export class TestClass {
  constructor(private name: string) {}
  
  getName() {
    return this.name;
  }
}

export default TestClass;