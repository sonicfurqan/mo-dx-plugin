import {core, flags, SfdxCommand} from '@salesforce/command';
import fs = require('fs-extra');
import {QueryResult} from '../../models/queryResult';
import {SobjectResult} from '../../models/sObjectResult';
import {createDeployRequest} from '../../service/containerasyncRequest';
import {createMetadataContainer} from '../../service/createmetadataContainer';
import {createMetadataMember} from '../../service/createmetadataMember';
import {executeToolingQuery} from '../../service/toolingQuery';

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('mo-dx-plugin', 'org');

export default class ApexDeploy extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  '$ $ sfdx deploy:apex -p filepath'
  ];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    classname: {type: 'string', required: false, char: 'n', description: 'name of the apex class' },
    filepath: {type: 'string', char: 'p', description: 'file path' }
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  public async run(): Promise<core.AnyJson> {

    const filebody = await fs.readFile(this.flags.filepath, 'utf8');
    const conn = this.org.getConnection();
    this.ux.startSpinner('Deploying....');
    // Create MetadataContainer request
    const metadataContainerResult = await createMetadataContainer('ApexContainer', conn) as SobjectResult;

    if (metadataContainerResult.success) {
      // get the apex class Id using the class Name
      const className = getapexClassName(this.flags.filepath);
      let query = 'Select Id from Apexclass where Name=\'';
      query = query + className + '\'';
      const apexclass = await executeToolingQuery(query, conn) as QueryResult;
      if (apexclass.records.length > 0) {
        const classId = apexclass.records[0].Id ;
        const apexClassMemberResult = await createMetadataMember('ApexClassMember', metadataContainerResult.id, filebody, classId, conn) as SobjectResult;
        if (apexClassMemberResult.success) {
          const containerAsyncResult = await createDeployRequest(metadataContainerResult.id, false, conn) as SobjectResult;
          if ( containerAsyncResult.id ) {
            this.ux.stopSpinner('Deployed....');
          }
        }
      }
      return 'success';
    }

    function getapexClassName(filepath: string) {
      return filepath.substring(filepath.lastIndexOf('/') + 1, filepath.lastIndexOf('.cls'));
    }
  }
}
