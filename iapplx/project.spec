Summary: %{_name} %{_version}
Name: %{_name}
Version: %{_version}
Release: %{_release}
BuildArch: noarch
License: Commercial
Group: Development/Tools
Packager: F5 Networks <support@f5.com>

%description
Framework for deploying configuration on BIG-IP using mustache templates

%define IAPP_INSTALL_DIR /var/config/rest/iapps/%{name}

%prep
echo -n %{version}-%{release} > %{_builddir}/version
cp -r %{main}/{nodejs,presentation} %{_builddir}
cp  %{main}/package*.json %{_builddir}
npm pack %{main}/../core
sed -i 's/..\/core/%{_mystiquepkg}/' %{_builddir}/package.json
npm install --only=prod --no-optional
rm %{_builddir}/%{_mystiquepkg}
cp -r %{main}/../html %{_builddir}
cp -r %{main}/../schemas %{_builddir}
cp -r %{main}/../templates %{_builddir}

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p $RPM_BUILD_ROOT%{IAPP_INSTALL_DIR}
cp -r %{_builddir}/* $RPM_BUILD_ROOT%{IAPP_INSTALL_DIR}

%clean rm -rf $RPM_BUILD_ROOT

%files
%defattr(-,root,root)
%{IAPP_INSTALL_DIR}
