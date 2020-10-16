import faker from "faker";
import execute from '../channels';

/////////////////////////////////////////////////////////////////////
/*   THIS FILE CONTAINS THE ALGORITHMS THAT GENERATE DUMMY DATA    */
/*                                                                 */
/* - The functions below are called in channels.ts                 */
/* - This process runs for each table where data is requested      */
/* - generateDummyData creates dummy data values in a table matrix */
/* - This matrix is passed to writeCSV file, which writes a        */
/*   file to the postgres-1 container                              */
/////////////////////////////////////////////////////////////////////

let keyObject:any;

//this object is generated by a method in models.ts
type schemaLayout = {
  tableNames: string[];
  tables: any;
}

//this object is created on the front end in DummyDataModal
type dummyDataRequest = {
  schemaName: string;
  dummyData: {};
}

//this function generates unique values for a column
const generatePrimayKey = () => {

}

// this function generates non-unique data for a column
//   dataType should be an object
//   ex: {
//     'data_type': 'integer';
//     'character_maximum_length': null
//   }
const generateDataByType = (columnObj) => {
  //faker.js method to generate data by type
  switch (columnObj.dataInfo.data_type) {
    case 'smallint':
      return faker.random.number({min: -32768, max: 32767});
    case 'integer':
      return faker.random.number({min: -2147483648, max: 2147483647});
    case 'bigint':
      return faker.random.number({min: -9223372036854775808, max: 9223372036854775807});
    case 'character varying':
      if (columnObj.dataInfo.character_maximum_length) {
        return faker.lorem.character(Math.floor(Math.random() * columnObj.dataInfo.character_maximum_length));
      }
      else return faker.lorem.word();
    case 'date':
      let result: string = '';
      let year: string = getRandomInt(1500, 2020).toString();
      let month: string = getRandomInt(1, 13).toString();
      if (month.length === 1) month = '0' + month;
      let day: string = getRandomInt(1, 29).toString();
      if (day.length === 1) day = '0' + day;
      result += year + '-' + month + '-' + day;
      return result;
    default:
      console.log('error')
  }
};

//helper function to generate random numbers that will ultimately represent a random date
const getRandomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

module.exports = {

  writeCSVFile: (tableMatrix, tableName, columnArray) => {
    const table: any = [];
    let row: any  = [];
    for(let i = 0; i < tableMatrix[0].length; i++) {
      for(let j = 0; j < tableMatrix.length; j++) {
          row.push(tableMatrix[j][i]); 
      }
      //join each subarray (which correspond to rows in our table) with a comma
      const rowString = row.join(',');
      table.push(rowString); //'1, luke, etc'
      row = [];
    }

    let csvString: string;
    //join tableMatrix with a line break (different on mac and windows because of line breaks in the bash CLI)
    if (process.platform === 'darwin') {
      const tableDataString: string = table.join('\n');
      const columnString: string = columnArray.join(',');
      csvString = columnString.concat('\n').concat(tableDataString);
    }

    else {
      const tableDataString: string = table.join('^\n');
      const columnString: string = columnArray.join(',');
      csvString = columnString.concat('^\n').concat(tableDataString);
    }

    //this returns a new promise to channels.ts, where it is put into an array and resolved after all promises have been created
    return new Promise((resolve, reject) => {
      let echoString = `echo "${csvString}" > ${tableName}`;
      console.log(echoString)
      execute(`docker exec postgres-1 bash -c "echo '${csvString}' > ${tableName}"`, console.log('wrote to file'));
      resolve(console.log('CSV created in container'));
    })
  },


  //maps table names from schemaLayout to sql files
  generateDummyData: (schemaLayout, dummyDataRequest, keyObject) => {
    const returnArray: any = [];

    //iterate over schemaLayout.tableNames array
    for (const tableName of schemaLayout.tableNames) {
      const tableMatrix: any = [];
      //if matching key exists in dummyDataRequest.dummyData
      if (dummyDataRequest.dummyData[tableName]) {
        //declare empty columnData array for tableMatrix
        let columnData: any = [];
        //declare an entry variable to carpture the entry we will push to column data
        let entry: any;

        //iterate over columnArray (i.e. an array of the column names for the table)
        let columnArray: string[] = schemaLayout.tables[tableName].map(columnObj => columnObj.columnName)
        for (let i = 0; i < columnArray.length; i++) {
          // declare a variable j (to be used in while loops below), set equal to zero
          let j: number = 0;
          // if this is a PK column, add numbers into column 0 to n-1 (ordered)
          if (keyObject[tableName].primaryKeyColumns[columnArray[i]]) {
            //while i < reqeusted number of rows
            while (j < dummyDataRequest.dummyData[tableName]) {
              //push into columnData
              columnData.push(j);
              // increment j
              j += 1;
            } 
          }

          // if this is a FK column, add random number between 0 and n-1 (inclusive) into column (unordered)
          else if (keyObject[tableName].foreignKeyColumns[columnArray[i]]) {
            //while j < reqeusted number of rows
            while (j < dummyDataRequest.dummyData[tableName]) {
              //generate an entry
              entry = Math.floor(Math.random() * (dummyDataRequest.dummyData[tableName]));
              //push into columnData
              columnData.push(entry);
              j += 1;
            }
          }
          
          // otherwise, we'll just add data by the type to which the column is constrained
          else {
            while (j < dummyDataRequest.dummyData[tableName]) {
              //generate an entry
              entry = generateDataByType(schemaLayout.tables[tableName][i]);
              //push into columnData
              columnData.push(entry);
              j += 1;
            };
          }

          //push columnData array into tableMatrix
          tableMatrix.push(columnData);
          //reset columnData array for next column
          columnData = [];
        };
        // only push something to the array if data was asked for for the specific table
        returnArray.push({tableName, data: tableMatrix});
      };
    };
    // then return the returnArray
    return returnArray;
  }
}