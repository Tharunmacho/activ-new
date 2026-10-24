#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>
#import <UIKit/UIKit.h>

@interface ReportExport : NSObject <RCTBridgeModule, UIDocumentPickerDelegate, NSURLSessionTaskDelegate>
@property(nonatomic, copy) RCTPromiseResolveBlock resolveExport;
@property(nonatomic, copy) RCTPromiseRejectBlock rejectExport;
@property(nonatomic, strong) NSURL *exportDirectory;
- (void)cleanUp;
- (void)exportData:(NSData *)data filename:(NSString *)filename resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject;
@end

@implementation ReportExport
RCT_EXPORT_MODULE();
+ (BOOL)requiresMainQueueSetup { return YES; }
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }

RCT_REMAP_METHOD(downloadChatFile, downloadChatFile:(NSString *)url token:(NSString *)token filename:(NSString *)filename mimeType:(NSString *)mimeType
                 resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *target = [NSURL URLWithString:url];
  NSRegularExpression *path = [NSRegularExpression regularExpressionWithPattern:@"^/api/v[0-9]+/messages/attachments/[a-fA-F0-9-]{36}$" options:0 error:nil];
  if (![target.scheme isEqualToString:@"https"] || ![target.host isEqualToString:@"api.activ.org.in"] || target.port || target.user || target.password || target.query || target.fragment
      || [path numberOfMatchesInString:target.path options:0 range:NSMakeRange(0, target.path.length)] != 1 || !token.length
      || [token rangeOfCharacterFromSet:[NSCharacterSet newlineCharacterSet]].location != NSNotFound) {
    reject(@"DOWNLOAD_FAILED", @"Sign in again to download this attachment.", nil);
    return;
  }
  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:target cachePolicy:NSURLRequestReloadIgnoringLocalCacheData timeoutInterval:60];
  [request setValue:[@"Bearer " stringByAppendingString:token] forHTTPHeaderField:@"Authorization"];
  NSURLSession *session = [NSURLSession sessionWithConfiguration:NSURLSessionConfiguration.ephemeralSessionConfiguration delegate:self delegateQueue:nil];
  [[session dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    [session finishTasksAndInvalidate];
    dispatch_async(dispatch_get_main_queue(), ^{
      if (error || [(NSHTTPURLResponse *)response statusCode] != 200 || !data.length || data.length > 10 * 1024 * 1024) {
        reject(@"DOWNLOAD_FAILED", @"The attachment is unavailable. Check your membership and try again.", error);
      } else {
        [self exportData:data filename:filename resolver:resolve rejecter:reject];
      }
    });
  }] resume];
}

- (void)URLSession:(NSURLSession *)session task:(NSURLSessionTask *)task willPerformHTTPRedirection:(NSHTTPURLResponse *)response newRequest:(NSURLRequest *)request completionHandler:(void (^)(NSURLRequest *))completionHandler
{
  completionHandler(nil);
}

RCT_REMAP_METHOD(saveCsv, saveCsv:(NSString *)filename contents:(NSString *)contents
                 resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  [self exportData:[contents dataUsingEncoding:NSUTF8StringEncoding] filename:filename resolver:resolve rejecter:reject];
}

RCT_REMAP_METHOD(saveSpreadsheet, saveSpreadsheet:(NSString *)filename base64:(NSString *)base64
                 resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  NSData *data = [[NSData alloc] initWithBase64EncodedString:base64 options:0];
  const unsigned char *bytes = (const unsigned char *)data.bytes;
  if (data.length < 4 || bytes[0] != 0x50 || bytes[1] != 0x4B) {
    reject(@"EXPORT_FAILED", @"The Excel report could not be prepared. Please try again.", nil);
    return;
  }
  [self exportData:data filename:filename resolver:resolve rejecter:reject];
}

- (void)exportData:(NSData *)data filename:(NSString *)filename resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject
{
  if (self.resolveExport) {
    reject(@"EXPORT_BUSY", @"Finish saving the current report first.", nil);
    return;
  }
  UIViewController *presenter = RCTPresentedViewController();
  if (!presenter) {
    reject(@"NO_ACTIVITY", @"Open ACTIV before exporting a report.", nil);
    return;
  }
  self.resolveExport = resolve;
  self.rejectExport = reject;
  self.exportDirectory = [NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:NSUUID.UUID.UUIDString] isDirectory:YES];
  NSURL *directory = self.exportDirectory;
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSError *error = nil;
    [[NSFileManager defaultManager] createDirectoryAtURL:directory withIntermediateDirectories:YES attributes:nil error:&error];
    NSURL *file = [directory URLByAppendingPathComponent:filename.lastPathComponent];
    if (!error) [data writeToURL:file options:NSDataWritingAtomic error:&error];
    dispatch_async(dispatch_get_main_queue(), ^{
      if (error) {
        self.rejectExport(@"EXPORT_FAILED", @"The report could not be prepared.", error);
        [self cleanUp];
        return;
      }
      UIDocumentPickerViewController *picker = [[UIDocumentPickerViewController alloc] initForExportingURLs:@[file] asCopy:YES];
      picker.delegate = self;
      picker.modalPresentationStyle = UIModalPresentationFormSheet;
      [presenter presentViewController:picker animated:YES completion:nil];
    });
  });
}

- (void)documentPicker:(UIDocumentPickerViewController *)controller didPickDocumentsAtURLs:(NSArray<NSURL *> *)urls
{
  if (self.resolveExport) self.resolveExport(@(urls.count > 0));
  [self cleanUp];
}

- (void)documentPickerWasCancelled:(UIDocumentPickerViewController *)controller
{
  if (self.resolveExport) self.resolveExport(@NO);
  [self cleanUp];
}

- (void)cleanUp
{
  if (self.exportDirectory) [[NSFileManager defaultManager] removeItemAtURL:self.exportDirectory error:NULL];
  self.exportDirectory = nil;
  self.resolveExport = nil;
  self.rejectExport = nil;
}
@end
