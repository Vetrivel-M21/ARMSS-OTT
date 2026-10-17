import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import '../storage/storage_service.dart';

class ApiClient {
  late final Dio dio;

  ApiClient() {
    dio = Dio(
      BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Keep base URL in sync if scheme was toggled by fallback
          options.baseUrl = ApiConstants.baseUrl;

          final token = await storageService.getToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) async {
          // Log or handle unauthorized responses globally
          if (e.response?.statusCode == 401) {
            // Token expired or invalid
            return handler.next(e);
          }

          // Check if this error is an SSL or connection failure eligible for HTTP/HTTPS fallback
          final isAlreadyRetried = e.requestOptions.extra['retried_scheme_fallback'] == true;
          final isNetworkOrSslError = e.type == DioExceptionType.connectionError ||
              e.type == DioExceptionType.connectionTimeout ||
              e.error.toString().toLowerCase().contains('handshake') ||
              e.error.toString().toLowerCase().contains('certificate') ||
              e.error.toString().toLowerCase().contains('cleartransit') ||
              e.error.toString().toLowerCase().contains('connection refused');

          if (!isAlreadyRetried && isNetworkOrSslError) {
            // Mark as retried to prevent infinite loops
            e.requestOptions.extra['retried_scheme_fallback'] = true;

            // Toggle scheme between HTTP and HTTPS
            ApiConstants.toggleScheme();
            dio.options.baseUrl = ApiConstants.baseUrl;

            final currentUrl = e.requestOptions.uri.toString();
            final fallbackUrl = currentUrl.startsWith('https://')
                ? currentUrl.replaceFirst('https://', 'http://')
                : currentUrl.replaceFirst('http://', 'https://');

            try {
              final response = await dio.request<dynamic>(
                fallbackUrl,
                data: e.requestOptions.data,
                queryParameters: e.requestOptions.queryParameters,
                options: Options(
                  method: e.requestOptions.method,
                  headers: e.requestOptions.headers,
                  extra: e.requestOptions.extra,
                  responseType: e.requestOptions.responseType,
                  contentType: e.requestOptions.contentType,
                ),
              );
              return handler.resolve(response);
            } catch (_) {
              // If fallback also failed, toggle scheme back and return original error
              ApiConstants.toggleScheme();
              dio.options.baseUrl = ApiConstants.baseUrl;
              return handler.next(e);
            }
          }

          return handler.next(e);
        },
      ),
    );
  }

  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) async {
    return await dio.get(path, queryParameters: queryParameters);
  }

  Future<Response> post(String path, {dynamic data, Map<String, dynamic>? queryParameters}) async {
    return await dio.post(path, data: data, queryParameters: queryParameters);
  }

  Future<Response> put(String path, {dynamic data}) async {
    return await dio.put(path, data: data);
  }

  Future<Response> delete(String path) async {
    return await dio.delete(path);
  }
}

final apiClient = ApiClient();
